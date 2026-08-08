import { promises as fs } from "node:fs";
import path from "node:path";
import {
	ChapterWriter,
	loadBible,
	MemoryStore,
	ProjectConfig,
	parseAliasesFromCharactersMd,
	resolveCharacterAliases,
	runWritePipeline,
	Summarizer,
} from "@essai/core";

export interface WriteOptions {
	cwd?: string;
	stdout?: { write(chunk: string): void };
	instruction?: string;
	/** Skip the pipeline and call ChapterWriter directly. */
	raw?: boolean;
	/** Run review but skip auto-fix (ignored when `raw` is true). */
	noFix?: boolean;
}

export const CHAPTERS_DIR = "chapters";
export const MEMORY_DIR = "memory";
const MEMORY_RECENT_COUNT = 3;

type ChapterArg = number | "next";

export function resolveChapterNumber(
	arg: ChapterArg,
	existing: string[],
): number {
	if (arg === "next") {
		if (existing.length === 0) return 1;
		const nums = existing
			.map((name) => Number.parseInt(name.replace(/\D/g, ""), 10))
			.filter((n) => Number.isFinite(n));
		const max = nums.length === 0 ? 0 : Math.max(...nums);
		return max + 1;
	}
	return arg;
}

async function listExistingChapters(projectDir: string): Promise<string[]> {
	try {
		return await fs.readdir(path.join(projectDir, CHAPTERS_DIR));
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}
}

export async function writeChapterCommand(
	arg: ChapterArg,
	opts: WriteOptions = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = opts.stdout ?? process.stdout;

	const [config, bible] = await Promise.all([
		ProjectConfig.load(cwd),
		loadBible(path.join(cwd, "bible")),
	]);

	const existing = await listExistingChapters(cwd);
	const chapterNumber = resolveChapterNumber(arg, existing);

	const plan = bible.chapters.get(chapterNumber);
	if (!plan) {
		throw new Error(
			`No chapter ${chapterNumber} plan found in bible/chapters.md`,
		);
	}

	const memoryStore = new MemoryStore();
	const rawMemories = await memoryStore.loadRecent(
		path.join(cwd, MEMORY_DIR),
		MEMORY_RECENT_COUNT,
	);
	// Resolve character aliases declared in bible/characters.md so the
	// LLM sees a unified character namespace (e.g. "카운터 여자" → "지아").
	// No-op when the author hasn't declared any aliases.
	let charactersMd = "";
	try {
		charactersMd = await fs.readFile(
			path.join(cwd, "bible", "characters.md"),
			"utf-8",
		);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
	}
	const aliases = parseAliasesFromCharactersMd(charactersMd);
	const memorySummaries = resolveCharacterAliases(rawMemories, aliases);

	let content: string;
	let wordCount: number;

	if (opts.raw) {
		const writer = new ChapterWriter(config, bible, cwd);
		const result = await writer.writeChapter(chapterNumber, {
			...(opts.instruction !== undefined
				? { instruction: opts.instruction }
				: {}),
			memorySummaries,
			onToken: (delta: string) => stdout.write(delta),
		});
		content = result.content;
		wordCount = result.wordCount;
	} else {
		const result = await runWritePipeline(
			chapterNumber,
			config,
			bible,
			cwd,
			memorySummaries,
			{
				...(opts.noFix ? { noFix: true } : {}),
				onProgress: (step) => {
					stdout.write(`[${step.stage}] ${step.message}\n`);
				},
			},
		);
		content = result.content;
		wordCount = result.wordCount;
	}

	stdout.write(
		`\n\nChapter ${chapterNumber} complete (${wordCount} characters).\n`,
	);

	const summarizer = new Summarizer();
	const memory = await summarizer.summarize(
		chapterNumber,
		plan.title,
		content,
		config,
	);
	await memoryStore.save(path.join(cwd, MEMORY_DIR), memory);
}
