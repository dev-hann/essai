import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getProjectDir } from "../../../../lib/projectDir";

export const dynamic = "force-dynamic";

const SECTION_RE = /^[A-Za-z0-9_-]+$/;

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ section: string }> },
) {
	try {
		const { section } = await params;
		if (!SECTION_RE.test(section)) {
			return NextResponse.json(
				{ error: "invalid section name" },
				{ status: 400 },
			);
		}

		const body = (await req.json()) as { content?: unknown };
		const content =
			typeof body.content === "string" ? body.content : String(body.content ?? "");

		const bibleDir = path.join(getProjectDir(), "bible");
		await fs.mkdir(bibleDir, { recursive: true });
		const fileName = section.endsWith(".md") ? section : `${section}.md`;
		const file = path.join(bibleDir, fileName);
		await fs.writeFile(file, content, "utf-8");

		return NextResponse.json({ ok: true, file: fileName });
	} catch (err) {
		const message = err instanceof Error ? err.message : "save failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
