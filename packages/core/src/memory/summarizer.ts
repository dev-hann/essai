import { generateText } from "ai";
import type { ProjectConfig } from "../config/project-config.js";
import { createModel } from "../llm/provider.js";
import { chapterMemorySchema, type ChapterMemory } from "./types.js";

const SUMMARY_JSON_SCHEMA = `{
  "events": string[],
  "emotions": Array<{ character: string; emotion: string; intensity: "low" | "medium" | "high"; note?: string }>,
  "foreshadowing": Array<{ item: string; status: "unresolved" | "active" | "resolved"; chapterIntroduced: number }>,
  "facts": string[],
  "characterState": Record<string, { location: string; mood: string; knows: string[] }>
}`;

function buildSummaryPrompt(chapter: number, title: string, content: string): string {
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
		const result = await generateText({
			model: createModel(config.llm),
			system: buildSummarySystem(config.language),
			prompt: buildSummaryPrompt(chapter, title, content),
			temperature: config.llm.temperature,
			maxOutputTokens: config.llm.maxTokens,
		});

		const parsed = JSON.parse(stripCodeFence(result.text)) as Record<string, unknown>;
		return chapterMemorySchema.parse({
			chapter,
			title,
			wordCount: content.length,
			events: parsed.events,
			emotions: parsed.emotions,
			foreshadowing: parsed.foreshadowing,
			facts: parsed.facts,
			characterState: parsed.characterState,
		});
	}
}
