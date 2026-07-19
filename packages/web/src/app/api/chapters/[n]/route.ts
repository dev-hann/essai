import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getProjectDir } from "../../../../lib/projectDir";

export const dynamic = "force-dynamic";

const PAD_WIDTH = 3;

function padChapter(n: number): string {
	return n.toString().padStart(PAD_WIDTH, "0");
}

async function readChapter(n: number): Promise<{ content: string; file: string } | null> {
	const chaptersDir = path.join(getProjectDir(), "chapters");
	const file = path.join(chaptersDir, `${padChapter(n)}.md`);
	try {
		const content = await fs.readFile(file, "utf-8");
		return { content, file };
	} catch {
		return null;
	}
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ n: string }> },
) {
	try {
		const { n } = await params;
		const number = Number(n);
		if (!Number.isFinite(number)) {
			return NextResponse.json({ error: "bad chapter number" }, { status: 400 });
		}
		const result = await readChapter(number);
		if (!result) {
			return NextResponse.json(
				{ error: `chapter ${number} not found` },
				{ status: 404 },
			);
		}
		return NextResponse.json({
			number,
			content: result.content,
			wordCount: result.content.length,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "load failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ n: string }> },
) {
	try {
		const { n } = await params;
		const number = Number(n);
		if (!Number.isFinite(number)) {
			return NextResponse.json({ error: "bad chapter number" }, { status: 400 });
		}
		const body = (await req.json()) as { content?: unknown };
		const content =
			typeof body.content === "string" ? body.content : String(body.content ?? "");

		const result = await readChapter(number);
		if (!result) {
			return NextResponse.json(
				{ error: `chapter ${number} not found` },
				{ status: 404 },
			);
		}
		await fs.writeFile(result.file, content, "utf-8");
		return NextResponse.json({ ok: true, wordCount: content.length });
	} catch (err) {
		const message = err instanceof Error ? err.message : "save failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
