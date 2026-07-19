import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
	isValidBibleSection,
} from "@/lib/chapters.js";
import { getProjectDir } from "@/lib/project-dir.js";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ s: string }>;
}

interface SaveBody {
	content?: string;
}

export async function POST(req: Request, { params }: RouteContext) {
	const { s: section } = await params;

	if (!isValidBibleSection(section)) {
		return NextResponse.json(
			{ error: `알 수 없는 bible 섹션: ${section}` },
			{ status: 400 },
		);
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
	const file = path.join(cwd, "bible", `${section}.md`);
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, body.content, "utf-8");

	return NextResponse.json({ section, filename: `${section}.md`, ok: true });
}
