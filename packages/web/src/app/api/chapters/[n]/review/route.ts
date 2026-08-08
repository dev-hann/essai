import path from "node:path";
import { ChapterReviewer, loadBible, ProjectConfig } from "@essai/core";
import { NextResponse } from "next/server";
import { readChapterFile } from "@/lib/chapters.js";
import { getProjectDir } from "@/lib/project-dir.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface ReviewBody {
	rules?: string;
}

interface RouteContext {
	params: Promise<{ n: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
	const { n } = await params;
	const number = Number.parseInt(n, 10);
	if (!Number.isFinite(number) || number < 1) {
		return NextResponse.json({ error: "잘못된 챕터 번호" }, { status: 400 });
	}

	let body: ReviewBody = {};
	try {
		body = (await req.json()) as ReviewBody;
	} catch {
		// empty body is fine
	}

	const cwd = getProjectDir();
	const content = await readChapterFile(cwd, number);
	if (content === null) {
		return NextResponse.json(
			{ error: `챕터 ${number}을(를) 찾을 수 없습니다` },
			{ status: 404 },
		);
	}

	const [config, bible] = await Promise.all([
		ProjectConfig.load(cwd),
		loadBible(path.join(cwd, "bible")),
	]);

	const reviewer = new ChapterReviewer(config);
	const result = await reviewer.reviewFull(content, bible, {
		...(body.rules ? { rules: body.rules } : {}),
	});

	return NextResponse.json(result);
}
