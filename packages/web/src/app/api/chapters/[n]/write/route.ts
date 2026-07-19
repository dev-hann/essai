import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { ChapterWriter, ProjectConfig, loadBible } from "@essai/core";
import { getProjectDir } from "../../../../../lib/projectDir";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAD_WIDTH = 3;

function padChapter(n: number): string {
	return n.toString().padStart(PAD_WIDTH, "0");
}

async function readChapter(n: number): Promise<string | null> {
	const file = path.join(
		getProjectDir(),
		"chapters",
		`${padChapter(n)}.md`,
	);
	try {
		return await fs.readFile(file, "utf-8");
	} catch {
		return null;
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ n: string }> },
) {
	try {
		const { n } = await params;
		const number = Number(n);
		if (!Number.isFinite(number)) {
			return NextResponse.json({ error: "bad chapter" }, { status: 400 });
		}

		const dir = getProjectDir();
		const config = await ProjectConfig.load(dir);
		const bible = await loadBible(path.join(dir, "bible"));

		const body = (await req.json().catch(() => ({}))) as {
			instruction?: string;
		};
		const existing = (await readChapter(number)) ?? "";

		const writer = new ChapterWriter(config, bible, dir);

		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				const send = (event: string, data: unknown) => {
					controller.enqueue(
						encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
					);
				};

				try {
					const result = await writer.writeChapter(number, {
						...(body.instruction !== undefined
							? { instruction: body.instruction }
							: {}),
						onToken: (delta) => send("token", delta),
					});
					send("done", {
						content: result.content,
						wordCount: result.wordCount,
						previous: existing,
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : "write failed";
					send("error", { message });
				} finally {
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "write failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
