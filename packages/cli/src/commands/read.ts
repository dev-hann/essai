import { promises as fs } from "node:fs";
import { chapterFile, type IoOpts, resolveStdout } from "./_shared.js";

export async function readChapter(
	chapter: number,
	opts: IoOpts = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);
	const file = chapterFile(cwd, chapter);
	const content = await fs.readFile(file, "utf-8");
	stdout.write(content);
}
