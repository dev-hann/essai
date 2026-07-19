import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { loadBible } from "@essai/core";
import { getProjectDir } from "../../../lib/projectDir";

export const dynamic = "force-dynamic";

const PAD_WIDTH = 3;

function padChapter(n: number): string {
	return n.toString().padStart(PAD_WIDTH, "0");
}

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

		const bible = await loadBible(path.join(dir, "bible"));

		const items = entries
			.filter((n) => /^\d+\.md$/.test(n))
			.map((name) => {
				const number = Number(name.slice(0, -".md".length));
				return { number, name };
			})
			.sort((a, b) => a.number - b.number);

		const result = await Promise.all(
			items.map(async ({ number, name }) => {
				const content = await fs.readFile(
					path.join(chaptersDir, name),
					"utf-8",
				);
				const plan = bible.chapters.get(number);
				return {
					number,
					title: plan?.title ?? `Chapter ${number}`,
					wordCount: content.length,
					status: "draft" as const,
				};
			}),
		);

		return NextResponse.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "load failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST() {
	try {
		const dir = getProjectDir();
		const chaptersDir = path.join(dir, "chapters");
		await fs.mkdir(chaptersDir, { recursive: true });

		const entries = (await fs.readdir(chaptersDir)).filter((n) =>
			/^\d+\.md$/.test(n),
		);
		const nextNumber =
			entries.length === 0
				? 1
				: Math.max(...entries.map((n) => Number(n.slice(0, -3)))) + 1;

		const file = path.join(chaptersDir, `${padChapter(nextNumber)}.md`);
		await fs.writeFile(file, "", "utf-8");
		return NextResponse.json({ number: nextNumber });
	} catch (err) {
		const message = err instanceof Error ? err.message : "create failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
