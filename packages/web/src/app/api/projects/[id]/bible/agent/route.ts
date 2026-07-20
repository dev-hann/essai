import { createModel, ProjectConfig } from "@essai/core";
import { sseResponse, SseWriter } from "@/lib/sse.js";
import {
	type AgentMessage,
	runBibleAgentTurn,
} from "@/lib/bible-agent-server.js";
import {
	ProjectNotFoundError,
	resolveProjectDir,
} from "@/lib/projectResolver.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface AgentRequestBody {
	message?: string | null;
	history?: AgentMessage[];
}

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
	const { id } = await params;

	let body: AgentRequestBody = {};
	try {
		body = (await req.json()) as AgentRequestBody;
	} catch {
		// empty body — start new session
	}

	const userMessage =
		typeof body.message === "string" ? body.message : null;
	const history = Array.isArray(body.history) ? body.history : [];

	let cwd: string;
	try {
		cwd = await resolveProjectDir(id);
	} catch (err) {
		if (err instanceof ProjectNotFoundError) {
			return new Response(`Unknown project: ${id}`, { status: 404 });
		}
		throw err;
	}

	return sseResponse(async (writer: SseWriter) => {
		const config = await ProjectConfig.load(cwd);

		if (!config.llm.baseUrl || !config.llm.model) {
			throw new Error(
				"LLM이 설정되지 않았습니다. 설정 페이지에서 model과 baseUrl을 입력하세요.",
			);
		}

		const model = createModel(config.llm);

		const result = await runBibleAgentTurn({
			model,
			config,
			projectDir: cwd,
			history,
			userMessage,
			onMessage: async (text) => {
				await writer.event("message", { text });
			},
			onSaved: async (evt) => {
				await writer.event("saved-file", evt);
			},
		});

		await writer.event("done", {
			finished: result.finished,
			history: result.history,
		});
	});
}
