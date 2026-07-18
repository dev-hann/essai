import { promises as fs } from "node:fs";
import path from "node:path";
import { type IoOpts, listChapterFiles, resolveStdout } from "./_shared.js";

export async function listChapters(opts: IoOpts = {}): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);
	const files = await listChapterFiles(cwd);

	stdout.write(`Chapters: ${files.length}\n\n`);

	let total = 0;
	for (const name of files) {
		const raw = await fs.readFile(path.join(cwd, "chapters", name), "utf-8");
		const count = raw.length;
		total += count;
		stdout.write(`${name.slice(0, -".md".length)}  ${count} characters\n`);
	}

	if (files.length > 0) {
		stdout.write(`\nTotal: ${total} characters\n`);
	}
}
