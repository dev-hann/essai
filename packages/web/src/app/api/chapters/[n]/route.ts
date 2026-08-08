import { promises as fs } from "node:fs";
import path from "node:path";
import { loadBible } from "@essai/core";
import { NextResponse } from "next/server";
import { chapterFilename, readChapterFile } from "@/lib/chapters.js";
import { getProjectDir } from "@/lib/project-dir.js";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ n: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
	const { n } = await params;
	const number = Number.parseInt(n, 10);
	if (!Number.isFinite(number) || number < 1) {
		return NextResponse.json({ error: "잘못된 챕터 번호" }, { status: 400 });
	}

	const cwd = getProjectDir();
	const content = await readChapterFile(cwd, number);
	const bible = await loadBible(path.join(cwd, "bible"));
	const plan = bible.chapters.get(number);

	if (content === null) {
		return NextResponse.json(
			{ error: `챕터 ${number}을(를) 찾을 수 없습니다` },
			{ status: 404 },
		);
	}

	return NextResponse.json({
		number,
		id: chapterFilename(number).slice(0, -".md".length),
		content,
		wordCount: content.length,
		planned: plan !== undefined,
		title: plan?.title ?? null,
	});
}

interface SaveBody {
	content?: string;
}

export async function POST(req: Request, { params }: RouteContext) {
	const { n } = await params;
	const number = Number.parseInt(n, 10);
	if (!Number.isFinite(number) || number < 1) {
		return NextResponse.json({ error: "잘못된 챕터 번호" }, { status: 400 });
	}

	let body: SaveBody;
	try {
		body = (await req.json()) as SaveBody;
	} catch {
		return NextResponse.json({ error: "잘못된 JSON" }, { status: 400 });
	}

	if (typeof body.content !== "string") {
		return NextResponse.json(
			{ error: "content 필드가 필요합니다" },
			{ status: 400 },
		);
	}

	const cwd = getProjectDir();
	const file = path.join(cwd, "chapters", chapterFilename(number));
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, body.content, "utf-8");

	return NextResponse.json({
		number,
		id: chapterFilename(number).slice(0, -".md".length),
		wordCount: body.content.length,
	});
}
