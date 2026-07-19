import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getProjectDir } from "../../../lib/projectDir";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const dir = getProjectDir();
		const chaptersDir = path.join(dir, "chapters");
		let entries: string[] = [];
		try {
			entries = await fs.readdir(chaptersDir);
		} catch {
			entries = [];
		}

		const items = entries
			.filter((n) => /^\d+\.md$/.test(n))
			.map((name) => ({ name, number: Number(name.slice(0, -3)) }))
			.sort((a, b) => a.number - b.number);

		let totalWords = 0;
		const chapters = await Promise.all(
			items.map(async ({ number, name }) => {
				const stat = await fs.stat(path.join(chaptersDir, name));
				const content = await fs.readFile(
					path.join(chaptersDir, name),
					"utf-8",
				);
				totalWords += content.length;
				return {
					number,
					updatedAt: stat.mtimeMs,
					wordCount: content.length,
				};
			}),
		);

		let plannedChapters = 0;
		try {
			const raw = await fs.readFile(path.join(dir, "essai.json"), "utf-8");
			const data = JSON.parse(raw) as { plannedChapters?: unknown };
			if (typeof data.plannedChapters === "number") {
				plannedChapters = data.plannedChapters;
			}
		} catch {
			// plannedChapters optional
		}

		return NextResponse.json({
			chapters,
			totalWords,
			plannedChapters,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "status failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
