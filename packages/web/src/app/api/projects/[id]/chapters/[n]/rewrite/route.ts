import path from "node:path";
import {
	ChapterEditor,
	ChapterWriter,
	loadBible,
	MemoryStore,
	ProjectConfig,
	Summarizer,
} from "@essai/core";
import {
	ProjectNotFoundError,
	resolveProjectDir,
} from "@/lib/projectResolver.js";
import { type SseWriter, sseResponse } from "@/lib/sse.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MEMORY_DIR = "memory";
const MEMORY_RECENT_COUNT = 3;

interface RewriteBody {
	instruction?: string;
}

interface RouteContext {
	params: Promise<{ id: string; n: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
	const { id, n } = await params;
	const number = Number.parseInt(n, 10);
	if (!Number.isFinite(number) || number < 1) {
		return new Response("invalid chapter number", { status: 400 });
	}

	let body: RewriteBody = {};
	try {
		body = (await req.json()) as RewriteBody;
	} catch {
		// empty body is fine
	}

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
		const [config, bible] = await Promise.all([
			ProjectConfig.load(cwd),
			loadBible(path.join(cwd, "bible")),
		]);

		const plan = bible.chapters.get(number);
		if (!plan) {
			throw new Error(`bible/chapters.md에 ${number}화 계획이 없습니다`);
		}

		const memoryStore = new MemoryStore();
		const memorySummaries = await memoryStore.loadRecent(
			path.join(cwd, MEMORY_DIR),
			MEMORY_RECENT_COUNT,
		);

		const chapterWriter = new ChapterWriter(config, bible, cwd);
		const editor = new ChapterEditor(chapterWriter);

		const { content, wordCount } = await editor.rewrite(number, {
			...(body.instruction ? { instruction: body.instruction } : {}),
			memorySummaries,
			onToken: (delta) => {
				void writer.event("token", { delta });
			},
		});

		await writer.event("saved", {
			wordCount,
			path: `chapters/${number.toString().padStart(3, "0")}.md`,
		});

		const summarizer = new Summarizer();
		try {
			const memory = await summarizer.summarize(
				number,
				plan.title,
				content,
				config,
			);
			await memoryStore.save(path.join(cwd, MEMORY_DIR), memory);
		} catch (err) {
			await writer.event("warning", {
				message:
					err instanceof Error
						? `memory save failed: ${err.message}`
						: "memory save failed",
			});
		}

		await writer.event("done", { wordCount });
	});
}
