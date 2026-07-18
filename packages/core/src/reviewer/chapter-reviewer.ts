import { generateText } from "ai";
import type { BibleData } from "../bible/types.js";
import type { ProjectConfig } from "../config/project-config.js";
import { createModel } from "../llm/provider.js";

export interface ReviewOptions {
	rules?: string;
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

		const result = await generateText({
			model: createModel(this.config.llm),
			system: buildSystemPrompt(bible, this.config.language, options.rules),
			prompt: content,
			temperature: this.config.llm.temperature,
			maxOutputTokens: this.config.llm.maxTokens,
		});

		return result.text;
	}
}
