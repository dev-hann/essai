import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GlobalConfig, type GlobalProjectEntry } from "@essai/core";

/**
 * Project discovery for the TUI.
 *
 * Reads the global config (~/.essai/config.json) and returns the list of
 * registered projects. The TUI is read-only relative to the global config:
 * it never creates or modifies projects, only picks one to browse.
 */

export async function listProjects(): Promise<GlobalProjectEntry[]> {
	try {
		const global = await GlobalConfig.load(os.homedir());
		return global.listProjects();
	} catch {
		return [];
	}
}

export interface ChapterSummary {
	number: number;
	fileName: string;
	wordCount: number;
}

const PAD = 3;
const CHAPTER_FILE = /^(\d+)\.md$/;

export async function listChapters(
	projectDir: string,
): Promise<ChapterSummary[]> {
	const chaptersDir = path.join(projectDir, "chapters");
	let entries: string[];
	try {
		entries = await fs.readdir(chaptersDir);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}

	const summaries: ChapterSummary[] = [];
	for (const entry of entries) {
		const match = entry.match(CHAPTER_FILE);
		if (!match) continue;
		const number = Number.parseInt(match[1] ?? "", 10);
		if (!Number.isFinite(number)) continue;
		const stat = await fs.stat(path.join(chaptersDir, entry));
		summaries.push({
			number,
			fileName: entry,
			wordCount: stat.size,
		});
	}
	return summaries.sort((a, b) => a.number - b.number);
}

export async function readChapter(
	projectDir: string,
	chapter: number,
): Promise<string> {
	const file = path.join(
		projectDir,
		"chapters",
		`${chapter.toString().padStart(PAD, "0")}.md`,
	);
	return fs.readFile(file, "utf-8");
}

export interface BibleSection {
	name: string;
	content: string;
}

export async function listBibleSections(
	projectDir: string,
): Promise<BibleSection[]> {
	const bibleDir = path.join(projectDir, "bible");
	let entries: string[];
	try {
		entries = await fs.readdir(bibleDir);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}

	const sections: BibleSection[] = [];
	for (const entry of entries.sort()) {
		if (!entry.endsWith(".md")) continue;
		const content = await fs.readFile(path.join(bibleDir, entry), "utf-8");
		sections.push({ name: entry, content });
	}
	return sections;
}
