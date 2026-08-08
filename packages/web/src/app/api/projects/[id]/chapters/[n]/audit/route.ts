import path from "node:path";
import {
	ContinuityAuditor,
	loadBible,
	loadWorld,
	MemoryStore,
	ProjectConfig,
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
export const maxDuration = 300;

interface AuditBody {
	only?: string[];
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

	let body: AuditBody = {};
	try {
		body = (await req.json()) as AuditBody;
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

	const config = await ProjectConfig.load(cwd);
	if (!config.llm.baseUrl || !config.llm.apiKey || !config.llm.model) {
		return NextResponse.json(
			{ error: "LLM 설정이 필요합니다 (llm.baseUrl/apiKey/model)" },
			{ status: 400 },
		);
	}

	const [bible, world] = await Promise.all([
		loadBible(path.join(cwd, "bible")),
		loadWorld(path.join(cwd, "bible")),
	]);
	const memoryStore = new MemoryStore();
	const memory = await memoryStore.loadRecent(path.join(cwd, "memory"), 3);

	const auditor = new ContinuityAuditor(config);
	const findings: ValidationFinding[] = await auditor.audit(
		number,
		content,
		bible,
		memory,
		world,
		{
			...(body.only && body.only.length > 0
				? { only: body.only as never }
				: {}),
		},
	);

	return NextResponse.json({ findings });
}
