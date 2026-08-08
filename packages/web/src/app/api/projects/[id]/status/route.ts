import { promises as fs } from "node:fs";
import path from "node:path";
import {
	type ChapterMemory,
	findEmotionStage,
	loadBible,
	MemoryStore,
} from "@essai/core";
import { NextResponse } from "next/server";
import { listChapterFiles } from "@/lib/chapters.js";
import {
	ProjectNotFoundError,
	resolveProjectDir,
} from "@/lib/projectResolver.js";

export const dynamic = "force-dynamic";

const MEMORY_DIR = "memory";
const MEMORY_RECENT_COUNT = 3;
const OPEN_FORESHADOW_STATUSES = new Set(["unresolved", "active"]);

function nextAfter(latestWritten: number, planned: number[]): number | null {
	if (planned.length === 0) return null;
	const sorted = [...planned].sort((a, b) => a - b);
	const max = sorted[sorted.length - 1];
	if (max === undefined) return null;
	for (let n = latestWritten + 1; n <= max; n++) {
		if (planned.includes(n)) return n;
	}
	return null;
}

function collectOpenForeshadowing(memories: ChapterMemory[]) {
	const seen = new Set<string>();
	const out: Array<{ chapter: number; item: string }> = [];
	for (const memory of memories) {
		for (const item of memory.foreshadowing) {
			if (!OPEN_FORESHADOW_STATUSES.has(item.status)) continue;
			const key = `${item.chapterIntroduced}:${item.item}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ chapter: item.chapterIntroduced, item: item.item });
		}
	}
	return out;
}

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
	const { id } = await params;
	let cwd: string;
	try {
		cwd = await resolveProjectDir(id);
	} catch (err) {
		if (err instanceof ProjectNotFoundError) {
			return NextResponse.json(
				{ error: `Unknown project: ${id}` },
				{ status: 404 },
			);
		}
		throw err;
	}

	const [bible, files, recentMemories] = await Promise.all([
		loadBible(path.join(cwd, "bible")),
		listChapterFiles(cwd),
		new MemoryStore().loadRecent(
			path.join(cwd, MEMORY_DIR),
			MEMORY_RECENT_COUNT,
		),
	]);

	const written = files
		.map((name) => Number.parseInt(name.replace(/\D/g, ""), 10))
		.filter((n) => Number.isFinite(n))
		.sort((a, b) => a - b);
	const count = written.length;
	const latest = count === 0 ? 0 : (written[count - 1] ?? 0);
	const planned = Array.from(bible.chapters.keys()).sort((a, b) => a - b);
	const next = count === 0 ? (planned[0] ?? null) : nextAfter(latest, planned);

	let totalCharacters = 0;
	for (const name of files) {
		try {
			const raw = await fs.readFile(path.join(cwd, "chapters", name), "utf-8");
			totalCharacters += raw.length;
		} catch {
			// skip
		}
	}

	const emotionStage =
		bible.emotion.length > 0 && next !== null
			? findEmotionStage(bible.emotion, next)
			: null;

	const openForeshadowing = collectOpenForeshadowing(recentMemories);

	return NextResponse.json({
		writtenCount: count,
		plannedCount: planned.length,
		latestWritten: count === 0 ? null : latest,
		next,
		totalCharacters,
		emotionStage: emotionStage
			? {
					stage: emotionStage.stage,
					name: emotionStage.name,
					chapters: emotionStage.chapters,
				}
			: null,
		openForeshadowing,
	});
}
