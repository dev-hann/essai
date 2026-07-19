/**
 * Minimal Server-Sent Events writer for Next.js Route Handlers running on the
 * Node.js runtime.
 */
export class SseWriter {
	constructor(
		private readonly controller: ReadableStreamDefaultController<Uint8Array>,
		private readonly encoder: TextEncoder,
	) {}

	async event(name: string, data: unknown): Promise<void> {
		const payload =
			typeof data === "string" ? data : JSON.stringify(data);
		const chunk = `event: ${name}\ndata: ${payload}\n\n`;
		this.controller.enqueue(this.encoder.encode(chunk));
	}

	close(): void {
		this.controller.close();
	}
}

export const sseHeaders: Readonly<Record<string, string>> = {
	"Content-Type": "text/event-stream; charset=utf-8",
	"Cache-Control": "no-cache, no-transform",
	Connection: "keep-alive",
	"X-Accel-Buffering": "no",
};

export function sseResponse(
	write: (writer: SseWriter) => Promise<void>,
): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const writer = new SseWriter(controller, encoder);
			try {
				await write(writer);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				try {
					await writer.event("error", { message });
				} catch {
					// controller may already be closed
				}
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, { headers: sseHeaders });
}
