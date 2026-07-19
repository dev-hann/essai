import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { ChapterReviewer, ProjectConfig, loadBible } from "@essai/core";
import { getProjectDir } from "../../../../../lib/projectDir";

export const dynamic = "force-dynamic";

const PAD_WIDTH = 3;

function padChapter(n: number): string {
	return n.toString().padStart(PAD_WIDTH, "0");
}

export async function POST(
	_req: NextRequest,
	{ params }: { params: Promise<{ n: string }> },
) {
	try {
		const { n } = await params;
		const number = Number(n);
		if (!Number.isFinite(number)) {
			return NextResponse.json({ error: "bad chapter" }, { status: 400 });
		}

		const dir = getProjectDir();
		const file = path.join(dir, "chapters", `${padChapter(number)}.md`);
		let content: string;
		try {
			content = await fs.readFile(file, "utf-8");
		} catch {
			return NextResponse.json(
				{ error: `chapter ${number} not found` },
				{ status: 404 },
			);
		}

		const config = await ProjectConfig.load(dir);
		const bible = await loadBible(path.join(dir, "bible"));
		const reviewer = new ChapterReviewer(config);
		const result = await reviewer.reviewFull(content, bible);

		return NextResponse.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "review failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
