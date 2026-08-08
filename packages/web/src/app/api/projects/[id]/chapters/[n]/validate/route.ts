import path from "node:path";
import {
	loadWorld,
	ProjectConfig,
	StaticValidator,
	type ValidationFinding,
} from "@essai/core";
import { NextResponse } from "next/server";
import { readChapterFile } from "@/lib/chapters.js";
import {
	ProjectNotFoundError,
	resolveProjectDir,
} from "@/lib/projectResolver.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

interface ValidateBody {
	disable?: string[];
}

interface RouteContext {
	params: Promise<{ id: string; n: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
	const { id, n } = await params;
	const number = Number.parseInt(n, 10);
	if (!Number.isFinite(number) || number < 1) {
		return NextResponse.json({ error: "잘못된 챕터 번호" }, { status: 400 });
	}

	let body: ValidateBody = {};
	try {
		body = (await req.json()) as ValidateBody;
	} catch {
		// empty body is fine
	}

	let cwd: string;
	try {
		cwd = await resolveProjectDir(id);
	} catch (err) {
		if (err instanceof ProjectNotFoundError) {
			return NextResponse.json(
				{ error: `Unknown project: ${id}` },
				{ status: 404 },
			);
		}
		throw err;
	}

	const content = await readChapterFile(cwd, number);
	if (content === null) {
		return NextResponse.json(
			{ error: `챕터 ${number}을(를) 찾을 수 없습니다` },
			{ status: 404 },
		);
	}

	// Validate is a pure static check; ProjectConfig is only used to satisfy
	// the surrounding resolver. We don't need an LLM endpoint.
	void (await ProjectConfig.load(cwd));

	const world = await loadWorld(path.join(cwd, "bible"));
	const validator = new StaticValidator({
		...(body.disable && body.disable.length > 0
			? { disable: body.disable }
			: {}),
	});
	const findings: ValidationFinding[] = validator.validate(content, world);

	return NextResponse.json({ findings });
}
