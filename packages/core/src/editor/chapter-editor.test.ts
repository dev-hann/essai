import { describe, expect, it, vi } from "vitest";
import type {
	WriteChapterOptions,
	WriteChapterResult,
} from "../writer/chapter-writer.js";
import { ChapterEditor } from "./chapter-editor.js";

interface FakeWriter {
	writeChapter: ReturnType<typeof vi.fn>;
}

function newFakeWriter(): FakeWriter {
	return { writeChapter: vi.fn() };
}

function result(): WriteChapterResult {
	return { content: "다시 쓴 본문", wordCount: 7 };
}

describe("ChapterEditor", () => {
	describe("rewrite", () => {
		it("delegates to ChapterWriter.writeChapter with the same chapter number", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue(result());
			const editor = new ChapterEditor(writer);

			await editor.rewrite(3);

			expect(writer.writeChapter).toHaveBeenCalledTimes(1);
			expect(writer.writeChapter).toHaveBeenCalledWith(3, expect.anything());
		});

		it("forwards the instruction when provided", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue(result());
			const editor = new ChapterEditor(writer);

			await editor.rewrite(3, { instruction: "대화를 더 늘려" });

			const call = writer.writeChapter.mock
				.calls[0]?.[1] as WriteChapterOptions;
			expect(call.instruction).toBe("대화를 더 늘려");
		});

		it("omits the instruction field entirely when not provided", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue(result());
			const editor = new ChapterEditor(writer);

			await editor.rewrite(3);

			const call = writer.writeChapter.mock
				.calls[0]?.[1] as WriteChapterOptions;
			expect(call.instruction).toBeUndefined();
		});

		it("forwards onToken and memorySummaries through", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue(result());
			const editor = new ChapterEditor(writer);
			const onToken = vi.fn();
			const memorySummaries = [];

			await editor.rewrite(3, { onToken, memorySummaries });

			const call = writer.writeChapter.mock
				.calls[0]?.[1] as WriteChapterOptions;
			expect(call.onToken).toBe(onToken);
			expect(call.memorySummaries).toBe(memorySummaries);
		});

		it("returns the WriteChapterResult from the underlying writer", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue({
				content: "본문",
				wordCount: 2,
			});
			const editor = new ChapterEditor(writer);

			const out = await editor.rewrite(3);

			expect(out).toEqual({ content: "본문", wordCount: 2 });
		});
	});

	describe("partialRewrite", () => {
		it("builds an instruction that names the section to rework", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue(result());
			const editor = new ChapterEditor(writer);

			await editor.partialRewrite(3, "결말");

			const call = writer.writeChapter.mock
				.calls[0]?.[1] as WriteChapterOptions;
			expect(typeof call.instruction).toBe("string");
			expect(call.instruction).toContain("결말");
		});

		it("combines the section directive with an additional instruction", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue(result());
			const editor = new ChapterEditor(writer);

			await editor.partialRewrite(3, "결말", {
				instruction: "더 여운 남게",
			});

			const call = writer.writeChapter.mock
				.calls[0]?.[1] as WriteChapterOptions;
			expect(call.instruction).toContain("결말");
			expect(call.instruction).toContain("더 여운 남게");
		});

		it("targets the same chapter number passed in", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue(result());
			const editor = new ChapterEditor(writer);

			await editor.partialRewrite(7, "도입부");

			expect(writer.writeChapter).toHaveBeenCalledWith(7, expect.anything());
		});

		it("always provides a non-undefined instruction (the directive)", async () => {
			const writer = newFakeWriter();
			writer.writeChapter.mockResolvedValue(result());
			const editor = new ChapterEditor(writer);

			await editor.partialRewrite(3, "도입부");

			const call = writer.writeChapter.mock
				.calls[0]?.[1] as WriteChapterOptions;
			expect(call.instruction).not.toBeUndefined();
			expect(call.instruction.length).toBeGreaterThan(0);
		});
	});
});
