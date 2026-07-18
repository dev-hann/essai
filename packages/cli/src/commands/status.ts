import { loadBible } from "@essai/core";
import {
	type IoOpts,
	listWrittenChapterNumbers,
	resolveStdout,
} from "./_shared.js";

function nextAfter(latestWritten: number, planned: number[]): number | null {
	if (planned.length === 0) return null;
	const sortedPlanned = [...planned].sort((a, b) => a - b);
	const max = sortedPlanned[sortedPlanned.length - 1];
	if (max === undefined) return null;
	for (let n = latestWritten + 1; n <= max; n++) {
		if (planned.includes(n)) return n;
	}
	return null;
}

export async function showStatus(opts: IoOpts = {}): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);

	const bible = await loadBible(`${cwd}/bible`);
	const written = await listWrittenChapterNumbers(cwd);
	const count = written.length;
	const latest = count === 0 ? 0 : (written[count - 1] ?? 0);
	const planned = Array.from(bible.chapters.keys()).sort((a, b) => a - b);
	const next = count === 0 ? (planned[0] ?? null) : nextAfter(latest, planned);

	stdout.write(`Chapters written: ${count}\n`);
	if (count > 0) stdout.write(`Latest written: ${latest}\n`);
	if (next !== null) stdout.write(`Next: ${next}\n`);
	stdout.write(`Planned chapters: ${planned.length}\n`);
}
