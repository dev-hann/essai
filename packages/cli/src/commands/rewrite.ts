import { promises as fs } from "node:fs";
import path from "node:path";
import {
	ChapterEditor,
	ChapterWriter,
	loadBible,
	MemoryStore,
	ProjectConfig,
	parseAliasesFromCharactersMd,
	resolveCharacterAliases,
	Summarizer,
} from "@essai/core";
import { type IoOpts, resolveStdout } from "./_shared.js";

export interface RewriteOptions extends IoOpts {
	instruction?: string;
}

const MEMORY_DIR = "memory";
const MEMORY_RECENT_COUNT = 3;
const PAD_WIDTH = 3;

function chapterFilePath(projectDir: string, chapter: number): string {
	return path.join(
		projectDir,
		"chapters",
		`${chapter.toString().padStart(PAD_WIDTH, "0")}.md`,
	);
}

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
	const rawMemories = await memoryStore.loadRecent(
		path.join(cwd, MEMORY_DIR),
		MEMORY_RECENT_COUNT,
	);
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

	// Backup the existing chapter before the writer overwrites it. The
	// pipeline fix step already does this, but the standalone `rewrite`
	// command bypasses the pipeline and used to leave no recovery path
	// if the second generation returned empty or wrong content. We keep
	// the .bak on disk afterwards so the author can compare manually.
	const chapterFile = chapterFilePath(cwd, chapter);
	const backupFile = `${chapterFile}.bak`;
	try {
		await fs.copyFile(chapterFile, backupFile);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
	}

	const writer = new ChapterWriter(config, bible, cwd);
	const editor = new ChapterEditor(writer);

	try {
		const { content, wordCount } = await editor.rewrite(chapter, {
			...(opts.instruction !== undefined
				? { instruction: opts.instruction }
				: {}),
			memorySummaries,
			onToken: (delta: string) => stdout.write(delta),
		});

		stdout.write(
			`\n\nChapter ${chapter} rewritten (${wordCount} characters).\n`,
		);

		const summarizer = new Summarizer();
		const memory = await summarizer.summarize(
			chapter,
			plan.title,
			content,
			config,
		);
		await memoryStore.save(path.join(cwd, MEMORY_DIR), memory);
	} catch (err) {
		// Generation failed (empty-content guard, stream error, etc.).
		// Restore the original chapter so we don't leave the user with a
		// truncated or wiped file. The .bak is preserved for inspection.
		try {
			const backup = await fs.readFile(backupFile, "utf-8");
			await fs.writeFile(chapterFile, backup, "utf-8");
		} catch (restoreErr) {
			if ((restoreErr as NodeJS.ErrnoException).code !== "ENOENT") {
				stdout.write(
					`warn: could not restore from .bak: ${(restoreErr as Error).message}\n`,
				);
			}
		}
		throw err;
	}
}
