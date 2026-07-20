import { promises as fs } from "node:fs";
import path from "node:path";
import { loadBible, type BibleData } from "@essai/core";
import { listChapterFiles } from "@/lib/chapters.js";

export interface ProjectStats {
	writtenCount: number;
	plannedCount: number;
	totalCharacters: number;
}

async function safeLoadBible(projectDir: string): Promise<BibleData | null> {
	try {
		return await loadBible(path.join(projectDir, "bible"));
	} catch {
		return null;
	}
}

export async function loadProjectStats(
	projectDir: string,
): Promise<ProjectStats> {
	const [bible, files] = await Promise.all([
		safeLoadBible(projectDir),
		listChapterFiles(projectDir),
	]);

	let totalCharacters = 0;
	for (const name of files) {
		try {
			const raw = await fs.readFile(
				path.join(projectDir, "chapters", name),
				"utf-8",
			);
			totalCharacters += raw.length;
		} catch {
			// skip unreadable
		}
	}

	const plannedCount = bible?.chapters.size ?? 0;

	return {
		writtenCount: files.length,
		plannedCount,
		totalCharacters,
	};
}
