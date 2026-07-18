import path from "node:path";
import {
	ChapterEditor,
	ChapterWriter,
	loadBible,
	MemoryStore,
	ProjectConfig,
	Summarizer,
} from "@essai/core";
import { type IoOpts, resolveStdout } from "./_shared.js";

export interface RewriteOptions extends IoOpts {
	instruction?: string;
}

const MEMORY_DIR = "memory";
const MEMORY_RECENT_COUNT = 3;

export async function rewriteChapterCommand(
	chapter: number,
	opts: RewriteOptions = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);

	const [config, bible] = await Promise.all([
		ProjectConfig.load(cwd),
		loadBible(path.join(cwd, "bible")),
	]);

	const plan = bible.chapters.get(chapter);
	if (!plan) {
		throw new Error(`No chapter ${chapter} plan found in bible/chapters.md`);
	}

	const memoryStore = new MemoryStore();
	const memorySummaries = await memoryStore.loadRecent(
		path.join(cwd, MEMORY_DIR),
		MEMORY_RECENT_COUNT,
	);

	const writer = new ChapterWriter(config, bible, cwd);
	const editor = new ChapterEditor(writer);

	const { content, wordCount } = await editor.rewrite(chapter, {
		...(opts.instruction !== undefined
			? { instruction: opts.instruction }
			: {}),
		memorySummaries,
		onToken: (delta: string) => stdout.write(delta),
	});

	stdout.write(`\n\nChapter ${chapter} rewritten (${wordCount} characters).\n`);

	const summarizer = new Summarizer();
	const memory = await summarizer.summarize(
		chapter,
		plan.title,
		content,
		config,
	);
	await memoryStore.save(path.join(cwd, MEMORY_DIR), memory);
}
