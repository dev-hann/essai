import { ProjectConfig } from "@essai/core";
import { NextResponse } from "next/server";
import {
	ProjectNotFoundError,
	resolveProjectDir,
} from "@/lib/projectResolver.js";

export const dynamic = "force-dynamic";

const MASKED_KEY = "***";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
	const { id } = await params;
	let dir: string;
	try {
		dir = await resolveProjectDir(id);
	} catch (err) {
		if (err instanceof ProjectNotFoundError) {
			return NextResponse.json(
				{ error: `Unknown project: ${id}` },
				{ status: 404 },
			);
		}
		throw err;
	}

	try {
		const config = await ProjectConfig.load(dir);
		return NextResponse.json({
			name: config.name,
			language: config.language,
			chapterWords: config.chapterWords,
			llm: {
				...config.llm,
				apiKey: config.llm.apiKey ? MASKED_KEY : "",
			},
		});
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : String(err) },
			{ status: 500 },
		);
	}
}

interface ConfigRequestBody {
	name?: string;
	language?: string;
	chapterWords?: number;
	llm?: {
		baseUrl?: string;
		apiKey?: string;
		model?: string;
		temperature?: number;
		maxTokens?: number;
		thinkingEnabled?: boolean;
	};
}

export async function POST(req: Request, { params }: RouteContext) {
	const { id } = await params;
	let dir: string;
	try {
		dir = await resolveProjectDir(id);
	} catch (err) {
		if (err instanceof ProjectNotFoundError) {
			return NextResponse.json(
				{ error: `Unknown project: ${id}` },
				{ status: 404 },
			);
		}
		throw err;
	}

	let body: ConfigRequestBody;
	try {
		body = (await req.json()) as ConfigRequestBody;
	} catch {
		return NextResponse.json({ error: "잘못된 JSON" }, { status: 400 });
	}

	let existing: ProjectConfig;
	try {
		existing = await ProjectConfig.load(dir);
	} catch {
		existing = ProjectConfig.fromEnv();
	}

	const next = new ProjectConfig({
		name: body.name ?? existing.name,
		language: body.language ?? existing.language,
		chapterWords: body.chapterWords ?? existing.chapterWords,
		llm: {
			baseUrl: body.llm?.baseUrl ?? existing.llm.baseUrl,
			apiKey:
				body.llm?.apiKey && body.llm.apiKey !== MASKED_KEY
					? body.llm.apiKey
					: existing.llm.apiKey,
			model: body.llm?.model ?? existing.llm.model,
			temperature: body.llm?.temperature ?? existing.llm.temperature,
			maxTokens: body.llm?.maxTokens ?? existing.llm.maxTokens,
			thinkingEnabled:
				body.llm?.thinkingEnabled ?? existing.llm.thinkingEnabled,
		},
	});

	try {
		await next.save(dir);
		return NextResponse.json({
			name: next.name,
			language: next.language,
			chapterWords: next.chapterWords,
			llm: {
				...next.llm,
				apiKey: next.llm.apiKey ? MASKED_KEY : "",
			},
		});
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : String(err) },
			{ status: 500 },
		);
	}
}
