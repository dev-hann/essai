import { promises as fs } from "node:fs";
import path from "node:path";
import { ChapterReviewer, loadBible, ProjectConfig } from "@essai/core";
import { chapterFile, type IoOpts, resolveStdout } from "./_shared.js";

export interface ReviewOptions extends IoOpts {
	rules?: string;
}

export async function reviewChapterCommand(
	chapter: number,
	opts: ReviewOptions = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);

	const file = chapterFile(cwd, chapter);
	let content: string;
	try {
		content = await fs.readFile(file, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(`Chapter ${chapter} not found at ${file}`);
		}
		throw err;
	}

	const [config, bible] = await Promise.all([
		ProjectConfig.load(cwd),
		loadBible(path.join(cwd, "bible")),
	]);

	let rules: string | undefined;
	if (opts.rules) {
		try {
			rules = await fs.readFile(opts.rules, "utf-8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				throw new Error(`Rules file not found: ${opts.rules}`);
			}
			throw err;
		}
	}

	const reviewer = new ChapterReviewer(config);
	const feedback = await reviewer.review(content, bible, {
		...(rules !== undefined ? { rules } : {}),
	});

	stdout.write(`${feedback}\n`);
}
