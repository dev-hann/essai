import { promises as fs } from "node:fs";
import path from "node:path";
import { loadBible } from "@essai/core";
import { NextResponse } from "next/server";
import { chapterNumberFromFilename, listChapterFiles } from "@/lib/chapters.js";
import { getProjectDir } from "@/lib/project-dir.js";

export const dynamic = "force-dynamic";

export async function GET() {
	const cwd = getProjectDir();
	const bible = await loadBible(path.join(cwd, "bible"));
	const files = await listChapterFiles(cwd);

	const chapters = await Promise.all(
		files.map(async (name) => {
			const number = chapterNumberFromFilename(name);
			if (number === null) return null;
			let wordCount = 0;
			try {
				const raw = await fs.readFile(
					path.join(cwd, "chapters", name),
					"utf-8",
				);
				wordCount = raw.length;
			} catch {
				// ignore
			}
			return {
				id: name.slice(0, -".md".length),
				number,
				wordCount,
			};
		}),
	);

	return NextResponse.json({
		chapters: chapters.filter(
			(c): c is { id: string; number: number; wordCount: number } => c !== null,
		),
		planned: Array.from(bible.chapters.keys()).sort((a, b) => a - b),
	});
}
