import { generateText } from "ai";
import type { ProjectConfig } from "../config/project-config.js";
import { createModel } from "../llm/provider.js";
import { type ChapterMemory, chapterMemorySchema } from "./types.js";

const SUMMARY_JSON_SCHEMA = `{
  "events": string[],
  "emotions": Array<{ character: string; emotion: string; intensity: "low" | "medium" | "high"; note?: string }>,
  "foreshadowing": Array<{ item: string; status: "unresolved" | "active" | "resolved"; chapterIntroduced: number }>,
  "facts": string[],
  "characterState": Record<string, { location: string; mood: string; knows: string[] }>,
  "propsIntroduced": string[],
  "propsUsed": string[],
  "timelinePosition"?: { month: string; relativeTo?: string },
  "languageLevel": Array<{ character: string; level: string; note?: string }>
}`;

function buildSummaryPrompt(
	chapter: number,
	title: string,
	content: string,
): string {
	return [
		`Chapter ${chapter} title: ${title}`,
		"",
		"Chapter content:",
		content,
	].join("\n");
}

function buildSummarySystem(language: string): string {
	return [
		"You are the memory engine for an Essai writing project.",
		"Read the chapter and extract a structured memory that the next chapter will rely on.",
		"",
		"## Rules",
		"- Extract only what actually happened in the text. Never invent facts.",
		"- events: 3 to 8 key plot beats in order.",
		"- emotions: per-character emotional shifts, using the form 'before -> after' when relevant.",
		"- foreshadowing: any setup that has not been paid off yet.",
		"- facts: objective, canonical facts the reader now knows.",
		"- characterState: latest location, mood, and salient knowledge per character.",
		"- propsIntroduced: physical objects that appear for the FIRST time in this",
		"  chapter (e.g. a gun pulled in ch7). Empty array if none.",
		"- propsUsed: every prop referenced in this chapter, whether new or returning.",
		"- timelinePosition: optional. Where this chapter sits on the story timeline.",
		"  Use a short anchor like '9월', 'day 3', '화요일', or '3 weeks later'.",
		"  Omit the field entirely if the text gives no temporal marker.",
		"- languageLevel: optional. Per-character language proficiency, only when the",
		"  story involves language evolution (e.g. 외국인 한국어 학습자). Empty otherwise.",
		"- Respond in the project language.",
		`- Write every prose value in ${language}.`,
		"",
		"## Output format",
		"Respond with ONLY a JSON object matching this TypeScript shape. No prose, no markdown:",
		SUMMARY_JSON_SCHEMA,
	].join("\n");
}

function stripCodeFence(text: string): string {
	const trimmed = text.trim();
	if (trimmed.startsWith("```")) {
		const end = trimmed.lastIndexOf("```");
		const inner = trimmed.slice(trimmed.indexOf("\n"), end);
		return inner.trim();
	}
	return trimmed;
}

export class Summarizer {
	async summarize(
		chapter: number,
		title: string,
		content: string,
		config: ProjectConfig,
	): Promise<ChapterMemory> {
		// Refuse to summarize empty content: the model often replies with a
		// human-readable error ("챕터 내용이 비어 있습니다...") instead of JSON,
		// which crashes JSON.parse downstream. Return a minimal placeholder so
		// callers can still save a structurally-valid memory.
		if (content.trim().length === 0) {
			return chapterMemorySchema.parse({
				chapter,
				title,
				wordCount: 0,
				events: [],
				emotions: [],
				foreshadowing: [],
				facts: [
					`Chapter ${chapter} (${title}) had empty content; no memory extracted.`,
				],
				characterState: {},
			});
		}

		const result = await generateText({
			model: createModel(config.llm),
			system: buildSummarySystem(config.language),
			prompt: buildSummaryPrompt(chapter, title, content),
			temperature: config.llm.temperature,
			maxOutputTokens: config.llm.maxTokens,
		});

		const raw = stripCodeFence(result.text);
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(raw) as Record<string, unknown>;
		} catch (_err) {
			// Model returned prose/error text instead of JSON. Fall back to a
			// placeholder memory and surface the LLM output in `facts` so the
			// caller can diagnose without losing the chapter pipeline.
			return chapterMemorySchema.parse({
				chapter,
				title,
				wordCount: content.length,
				events: [],
				emotions: [],
				foreshadowing: [],
				facts: [
					`Summarizer received non-JSON response; memory extraction skipped.`,
					`LLM output (truncated): ${raw.slice(0, 200)}`,
				],
				characterState: {},
				propsIntroduced: [],
				propsUsed: [],
				languageLevel: [],
			});
		}

		return chapterMemorySchema.parse({
			chapter,
			title,
			wordCount: content.length,
			events: parsed.events,
			emotions: parsed.emotions,
			foreshadowing: parsed.foreshadowing,
			facts: parsed.facts,
			characterState: parsed.characterState,
			propsIntroduced: parsed.propsIntroduced,
			propsUsed: parsed.propsUsed,
			...(parsed.timelinePosition !== undefined
				? { timelinePosition: parsed.timelinePosition }
				: {}),
			languageLevel: parsed.languageLevel,
		});
	}
}
