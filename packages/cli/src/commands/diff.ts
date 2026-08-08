import { promises as fs } from "node:fs";
import path from "node:path";
import { type IoOpts, resolveStdout } from "./_shared.js";

/**
 * `essai diff <chapter>` — print a unified diff between the chapter and
 * its `.bak` (the pre-fix or pre-rewrite snapshot). Useful when the
 * pipeline fix step rewrote a chunk and the author wants to review what
 * changed without opening a full diff tool.
 *
 * The diff is computed with a tiny inline LCS so we don't need an
 * external `diff` binary. Output is unified-diff-ish: ` ` unchanged,
 * `-` only in `.bak`, `+` only in current.
 */

const PAD_WIDTH = 3;

export async function diffCommand(
	chapter: number,
	opts: IoOpts = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);

	const currentPath = path.join(
		cwd,
		"chapters",
		`${chapter.toString().padStart(PAD_WIDTH, "0")}.md`,
	);
	const backupPath = `${currentPath}.bak`;

	let current = "";
	let backup: string | null = null;
	try {
		current = await fs.readFile(currentPath, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`Chapter ${chapter} not found at ${path.relative(cwd, currentPath)}`,
			);
		}
		throw err;
	}
	try {
		backup = await fs.readFile(backupPath, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			stdout.write(
				`No .bak file for chapter ${chapter}. Run \`essai rewrite ${chapter}\` or wait for a pipeline fix step to create one.\n`,
			);
			return;
		}
		throw err;
	}

	const beforeLines = backup.split(/\r?\n/);
	const afterLines = current.split(/\r?\n/);

	const hunks = computeLcsHunks(beforeLines, afterLines);
	const added = hunks.filter((h) => h.kind === "+").length;
	const removed = hunks.filter((h) => h.kind === "-").length;

	stdout.write(
		`diff chapters/${chapter.toString().padStart(PAD_WIDTH, "0")}.md.bak → chapters/${chapter.toString().padStart(PAD_WIDTH, "0")}.md  (+${added} -${removed})\n\n`,
	);
	for (const h of hunks) {
		const prefix = h.kind === "+" ? "+" : h.kind === "-" ? "-" : " ";
		stdout.write(`${prefix}${h.line}\n`);
	}
}

type Hunks = Array<{ kind: " " | "+" | "-"; line: string }>;

/**
 * Smallest-useful LCS diff. Returns an array of {kind, line} tuples
 * that reconstruct both inputs: ' ' matches both, '-' only before, '+'
 * only after. O(n*m) memory — fine for chapter-sized inputs (<2k
 * lines).
 */
function computeLcsHunks(before: string[], after: string[]): Hunks {
	const n = before.length;
	const m = after.length;
	const table: number[][] = Array.from({ length: n + 1 }, () =>
		new Array<number>(m + 1).fill(0),
	);
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			table[i]![j] =
				before[i] === after[j]
					? table[i + 1]![j + 1]! + 1
					: Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
		}
	}
	const out: Hunks = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (before[i] === after[j]) {
			out.push({ kind: " ", line: before[i]! });
			i++;
			j++;
		} else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
			out.push({ kind: "-", line: before[i]! });
			i++;
		} else {
			out.push({ kind: "+", line: after[j]! });
			j++;
		}
	}
	while (i < n) {
		out.push({ kind: "-", line: before[i]! });
		i++;
	}
	while (j < m) {
		out.push({ kind: "+", line: after[j]! });
		j++;
	}
	return out;
}
