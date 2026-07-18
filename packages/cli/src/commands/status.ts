import { promises as fs } from "node:fs";
import path from "node:path";
import {
	type ChapterMemory,
	findEmotionStage,
	loadBible,
	MemoryStore,
} from "@essai/core";
import {
	type IoOpts,
	listChapterFiles,
	listWrittenChapterNumbers,
	resolveStdout,
} from "./_shared.js";

const MEMORY_DIR = "memory";
const MEMORY_RECENT_COUNT = 3;
const OPEN_FORESHADOW_STATUSES = new Set(["unresolved", "active"]);

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

async function totalCharacters(cwd: string, files: string[]): Promise<number> {
	let total = 0;
	for (const name of files) {
		const raw = await fs.readFile(path.join(cwd, "chapters", name), "utf-8");
		total += raw.length;
	}
	return total;
}

function countOpenForeshadowing(memories: ChapterMemory[]): number {
	const seen = new Set<string>();
	let count = 0;
	for (const memory of memories) {
		for (const item of memory.foreshadowing) {
			if (!OPEN_FORESHADOW_STATUSES.has(item.status)) continue;
			const key = `${item.chapterIntroduced}:${item.item}`;
			if (seen.has(key)) continue;
			seen.add(key);
			count += 1;
		}
	}
	return count;
}

export async function showStatus(opts: IoOpts = {}): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);

	const [bible, files, recentMemories] = await Promise.all([
		loadBible(`${cwd}/bible`),
		listChapterFiles(cwd),
		new MemoryStore().loadRecent(
			path.join(cwd, MEMORY_DIR),
			MEMORY_RECENT_COUNT,
		),
	]);

	const written = await listWrittenChapterNumbers(cwd);
	const count = written.length;
	const latest = count === 0 ? 0 : (written[count - 1] ?? 0);
	const planned = Array.from(bible.chapters.keys()).sort((a, b) => a - b);
	const next = count === 0 ? (planned[0] ?? null) : nextAfter(latest, planned);

	stdout.write(`Chapters written: ${count}\n`);
	if (count > 0) stdout.write(`Latest written: ${latest}\n`);
	if (next !== null) stdout.write(`Next: ${next}\n`);
	stdout.write(`Planned chapters: ${planned.length}\n`);

	const total = await totalCharacters(cwd, files);
	stdout.write(`Total characters: ${total}\n`);

	if (bible.emotion.length > 0 && next !== null) {
		const stage = findEmotionStage(bible.emotion, next);
		if (stage) {
			stdout.write(
				`Emotion stage: ${stage.stage}. ${stage.name} (${stage.chapters})\n`,
			);
		}
	}

	const openForeshadowing = countOpenForeshadowing(recentMemories);
	stdout.write(`Unresolved foreshadowing: ${openForeshadowing}\n`);
}
