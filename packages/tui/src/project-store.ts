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

/**
 * Spawn an essai CLI subcommand (`write next`, `audit <n>`, etc.) with the
 * project dir pinned via ESSAI_PROJECT_DIR. Inherits stdio so streaming
 * output reaches the terminal directly — Ink's render loop would interfere
 * if we tried to capture chunks ourselves.
 *
 * Resolves with the exit code. Non-zero exits are surfaced to the caller;
 * we don't throw so the TUI can show the error and resume navigation.
 */
export async function runEssaiCommand(
	args: string[],
	projectDir: string,
): Promise<number> {
	const { spawn } = await import("node:child_process");
	const cliEntry = await resolveCliEntry();
	return new Promise<number>((resolve) => {
		const child = spawn(process.execPath, [cliEntry, ...args], {
			cwd: projectDir,
			stdio: "inherit",
			env: {
				...process.env,
				ESSAI_PROJECT_DIR: projectDir,
			},
		});
		child.on("error", () => resolve(1));
		child.on("exit", (code) => resolve(code ?? 0));
	});
}

async function resolveCliEntry(): Promise<string> {
	const { fileURLToPath } = await import("node:url");
	const here = path.dirname(fileURLToPath(import.meta.url));
	// From packages/tui/dist/project-store.js → packages/cli/dist/index.js
	return path.resolve(here, "..", "..", "cli", "dist", "index.js");
}

/**
 * Find the latest written chapter number under <projectDir>/chapters.
 * Returns null when no chapters exist yet.
 */
export async function latestChapterNumber(
	projectDir: string,
): Promise<number | null> {
	const chapters = await listChapters(projectDir);
	if (chapters.length === 0) return null;
	return chapters[chapters.length - 1]!.number;
}
