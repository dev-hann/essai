import { promises as fs } from "node:fs";
import path from "node:path";

export interface IoOpts {
	cwd?: string;
	stdout?: { write(chunk: string): void };
}

export const PAD_WIDTH = 3;

export function padChapter(n: number): string {
	return n.toString().padStart(PAD_WIDTH, "0");
}

export function chapterFile(projectDir: string, chapter: number): string {
	return path.join(projectDir, "chapters", `${padChapter(chapter)}.md`);
}

export async function listChapterFiles(projectDir: string): Promise<string[]> {
	try {
		const entries = await fs.readdir(path.join(projectDir, "chapters"));
		return entries.filter((name) => name.endsWith(".md")).sort();
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}
}

export async function listWrittenChapterNumbers(
	projectDir: string,
): Promise<number[]> {
	const files = await listChapterFiles(projectDir);
	return files
		.map((name) => Number.parseInt(name.replace(/\D/g, ""), 10))
		.filter((n) => Number.isFinite(n))
		.sort((a, b) => a - b);
}

export function resolveStdout(opts: IoOpts): { write(chunk: string): void } {
	return opts.stdout ?? process.stdout;
}
