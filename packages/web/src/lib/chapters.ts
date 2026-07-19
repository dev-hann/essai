import { promises as fs } from "node:fs";
import path from "node:path";

/** Files the loader knows about, in canonical tab order. */
export const BIBLE_FILES = [
	"characters.md",
	"relationships.md",
	"emotion.md",
	"chapters.md",
	"style.md",
	"tone.md",
	"constraints.md",
] as const;

const PAD_WIDTH = 3;

export function padChapter(n: number): string {
	return n.toString().padStart(PAD_WIDTH, "0");
}

export function chapterFilename(n: number): string {
	return `${padChapter(n)}.md`;
}

export function chapterNumberFromFilename(name: string): number | null {
	const match = name.match(/^(\d+)\.md$/);
	if (!match) return null;
	const n = Number.parseInt(match[1] ?? "", 10);
	return Number.isFinite(n) ? n : null;
}

export async function readChapterFile(
	projectDir: string,
	n: number,
): Promise<string | null> {
	const file = path.join(projectDir, "chapters", chapterFilename(n));
	try {
		return await fs.readFile(file, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw err;
	}
}

export async function listChapterFiles(projectDir: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(path.join(projectDir, "chapters"));
		return entries.filter((name) => /^\d+\.md$/.test(name)).sort();
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}
}

export function isValidBibleSection(section: string): boolean {
	return (BIBLE_FILES as readonly string[]).includes(`${section}.md`);
}
