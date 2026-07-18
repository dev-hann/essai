import { promises as fs } from "node:fs";
import path from "node:path";
import { streamText } from "ai";
import type { BibleData } from "../bible/types.js";
import type { ProjectConfig } from "../config/project-config.js";
import { buildWriterPrompt } from "../llm/prompts.js";
import { createModel, thinkingProviderOptions } from "../llm/provider.js";
import type { ChapterMemory } from "../memory/types.js";

export interface WriteChapterOptions {
	instruction?: string;
	memorySummaries?: ChapterMemory[];
	onToken?: (delta: string) => void;
}

export interface WriteChapterResult {
	content: string;
	wordCount: number;
}

const PAD_WIDTH = 3;

function padChapter(n: number): string {
	return n.toString().padStart(PAD_WIDTH, "0");
}

export class ChapterWriter {
	private readonly projectDir: string;

	constructor(
		private readonly config: ProjectConfig,
		private readonly bible: BibleData,
		projectDir: string = ".",
	) {
		this.projectDir = projectDir;
	}

	async writeChapter(
		chapterNumber: number,
		options: WriteChapterOptions = {},
	): Promise<WriteChapterResult> {
		const { instruction, memorySummaries, onToken } = options;

		if (!this.config.llm.baseUrl || !this.config.llm.model) {
			throw new Error(
				"LLM is not configured. Set llm.baseUrl and llm.model in essai.json before writing.",
			);
		}

		const { system, user } = buildWriterPrompt({
			bible: this.bible,
			chapterNumber,
			language: this.config.language,
			chapterWords: this.config.chapterWords,
			...(instruction !== undefined ? { instruction } : {}),
			...(memorySummaries !== undefined ? { memory: memorySummaries } : {}),
		});

		const opts: Record<string, unknown> = {
			model: createModel(this.config.llm),
			system,
			prompt: user,
			temperature: this.config.llm.temperature,
			maxOutputTokens: this.config.llm.maxTokens,
		};
		const thinkingOpts = thinkingProviderOptions(this.config.llm);
		if (thinkingOpts) {
			opts.providerOptions = thinkingOpts;
		}

		const result = streamText(opts as Parameters<typeof streamText>[0]);

		let content = "";
		const resolved = await result;
		for await (const delta of resolved.textStream) {
			content += delta;
			onToken?.(delta);
		}

		// Awaiting the final text surfaces any error that the stream swallowed
		// (e.g. invalid URL, auth failure) so we never persist an empty chapter.
		await resolved.text;

		const chaptersDir = path.join(this.projectDir, "chapters");
		await fs.mkdir(chaptersDir, { recursive: true });
		const file = path.join(chaptersDir, `${padChapter(chapterNumber)}.md`);
		await fs.writeFile(file, content, "utf-8");

		return { content, wordCount: content.length };
	}
}
