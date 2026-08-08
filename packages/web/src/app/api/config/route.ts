import { ProjectConfig } from "@essai/core";
import { NextResponse } from "next/server";
import { getProjectDir } from "@/lib/project-dir.js";

const _CONFIG_FILENAME = "essai.json";
const MASKED_KEY = "***";

export const dynamic = "force-dynamic";

export async function GET() {
	const dir = getProjectDir();
	try {
		const config = await ProjectConfig.load(dir);
		return NextResponse.json({
			name: config.name,
			language: config.language,
			chapterWords: config.chapterWords,
			llm: { ...config.llm, apiKey: config.llm.apiKey ? MASKED_KEY : "" },
		});
	} catch (err) {
		return NextResponse.json(
			{
				error: err instanceof Error ? err.message : String(err),
			},
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

export async function POST(req: Request) {
	const dir = getProjectDir();
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
		// no config yet — fall back to env-derived skeleton
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
			llm: { ...next.llm, apiKey: next.llm.apiKey ? MASKED_KEY : "" },
		});
	} catch (err) {
		return NextResponse.json(
			{
				error: err instanceof Error ? err.message : String(err),
			},
			{ status: 500 },
		);
	}
}
