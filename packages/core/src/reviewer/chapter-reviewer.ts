import { generateText } from "ai";
import type { BibleData } from "../bible/types.js";
import type { ProjectConfig } from "../config/project-config.js";
import { createModel, thinkingProviderOptions } from "../llm/provider.js";
import type { ChapterMemory } from "../memory/types.js";
import { detectAITells } from "./ai-tells.js";

export interface ReviewOptions {
	rules?: string;
	memory?: ChapterMemory[];
}

export interface ReviewResult {
	/** LLM quality feedback */
	feedback: string;
	/** AI tells found (regex, no LLM) */
	aiTells: string[];
	/** Issues extracted from feedback for auto-fix */
	issues: string[];
	/** Whether auto-fix is recommended */
	needsFix: boolean;
}

function buildSystemPrompt(
	bible: BibleData,
	language: string,
	rules: string | undefined,
): string {
	const parts: string[] = [];
	parts.push(
		"You are the reviewer for an Essai writing project. Read the chapter and give honest, specific craft feedback.",
	);
	parts.push(
		"Do not assign a numeric score. Do not approve or reject. Write prose feedback only.",
	);
	parts.push(
		"Focus on: pacing, showing vs telling, dialogue naturalness, sensory specificity, bible compliance, and emotional truth.",
	);
	parts.push(`Write the feedback in ${language}.`);

	const style = bible.style.length
		? bible.style.map((s) => `- ${s}`).join("\n")
		: "";
	if (style) parts.push(`## Project Style\n${style}`);

	const tone = bible.tone.length
		? bible.tone.map((t) => `- ${t}`).join("\n")
		: "";
	if (tone) parts.push(`## Project Tone\n${tone}`);

	const constraints = bible.constraints.length
		? bible.constraints.map((c) => `- ${c}`).join("\n")
		: "";
	if (constraints) parts.push(`## Project Constraints\n${constraints}`);

	if (rules) parts.push(`## Additional Review Rules\n${rules}`);

	return parts.join("\n\n");
}

export class ChapterReviewer {
	constructor(private readonly config: ProjectConfig) {}

	async review(
		content: string,
		bible: BibleData,
		options: ReviewOptions = {},
	): Promise<string> {
		if (!this.config.llm.baseUrl || !this.config.llm.model) {
			throw new Error(
				"LLM is not configured. Set llm.baseUrl and llm.model in essai.json before reviewing.",
			);
		}

		const opts: Record<string, unknown> = {
			model: createModel(this.config.llm),
			system: buildSystemPrompt(bible, this.config.language, options.rules),
			prompt: content,
			temperature: this.config.llm.temperature,
			maxOutputTokens: this.config.llm.maxTokens,
		};
		const thinkingOpts = thinkingProviderOptions(this.config.llm);
		if (thinkingOpts) {
			opts.providerOptions = thinkingOpts;
		}

		const result = await generateText(
			opts as Parameters<typeof generateText>[0],
		);

		return result.text;
	}

	/**
	 * Full review: AI tells (regex) + quality feedback (LLM) + issue extraction.
	 * This is what the pipeline calls after write.
	 */
	async reviewFull(
		content: string,
		bible: BibleData,
		options: ReviewOptions = {},
	): Promise<ReviewResult> {
		// 1. AI tells — instant, no LLM
		const aiTellsResult = detectAITells(content);

		// 2. Quality feedback — LLM
		const memorySection = options.memory?.length
			? `\n\n## Previous Chapters Context\n${options.memory.map((m) => `Ch${m.chapter}: ${m.events.join("; ")}`).join("\n")}`
			: "";
		const feedbackContent = content + memorySection;
		const feedback = await this.review(feedbackContent, bible, options);

		// 3. Extract issues from feedback (simple heuristic)
		const issues = extractIssues(feedback);

		return {
			feedback,
			aiTells: aiTellsResult.found,
			issues,
			needsFix: aiTellsResult.count > 0 || issues.length > 0,
		};
	}
}

/**
 * Extract actionable issues from LLM feedback text.
 * Looks for bullet points, numbered issues, or sentences with issue keywords.
 */
function extractIssues(feedback: string): string[] {
	const issues: string[] = [];
	const lines = feedback.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Bullet points (-, *, •) or numbered (1., 2.)
		if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
			issues.push(trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""));
		}
	}

	return issues;
}
