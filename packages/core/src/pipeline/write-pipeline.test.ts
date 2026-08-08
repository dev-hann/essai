import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	writeChapter: vi.fn(),
	reviewFull: vi.fn(),
}));

vi.mock("../writer/chapter-writer.js", () => ({
	ChapterWriter: class FakeChapterWriter {
		writeChapter(
			...args: Parameters<typeof mocks.writeChapter>
		): ReturnType<typeof mocks.writeChapter> {
			return mocks.writeChapter(...args);
		}
	},
}));

vi.mock("../reviewer/chapter-reviewer.js", () => ({
	ChapterReviewer: class FakeChapterReviewer {
		reviewFull(
			...args: Parameters<typeof mocks.reviewFull>
		): ReturnType<typeof mocks.reviewFull> {
			return mocks.reviewFull(...args);
		}
	},
}));

vi.mock("../editor/chapter-editor.js", () => ({
	ChapterEditor: class FakeChapterEditor {
		constructor(private readonly writer: unknown) {}
		rewrite(
			chapter: number,
			opts: { instruction?: string },
		): Promise<{ content: string; wordCount: number }> {
			return (
				this.writer as {
					writeChapter: typeof mocks.writeChapter;
				}
			).writeChapter(chapter, opts);
		}
	},
}));

import type { BibleData } from "../bible/types.js";
import type { ProjectConfig } from "../config/project-config.js";
import type { ProjectConfigData } from "../config/schema.js";
import type { ReviewResult } from "../reviewer/chapter-reviewer.js";
import { runWritePipeline } from "./write-pipeline.js";

function sampleConfigData(): ProjectConfigData {
	return {
		name: "test-novel",
		language: "ko",
		chapterWords: 3000,
		llm: {
			baseUrl: "https://api.example.com/v4",
			apiKey: "secret-key",
			model: "glm-5.1",
			temperature: 0.7,
			maxTokens: 8000,
			thinkingEnabled: false,
		},
	};
}

function newConfig(data: ProjectConfigData): ProjectConfig {
	return {
		name: data.name,
		language: data.language,
		chapterWords: data.chapterWords,
		llm: data.llm,
		toJSON: () => data,
	} as unknown as ProjectConfig;
}

function sampleBible(): BibleData {
	return {
		characters: {},
		relationships: [],
		emotion: [],
		chapters: new Map([
			[1, { number: 1, title: "첫 만남", scenes: ["장면"] }],
		]),
		style: [],
		tone: [],
		constraints: [],
		additionalContext: {},
	};
}

function reviewResult(overrides: Partial<ReviewResult> = {}): ReviewResult {
	return {
		aiTells: [],
		issues: [],
		needsFix: false,
		...overrides,
	} as ReviewResult;
}

describe("runWritePipeline", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "essai-pipeline-"));
		mocks.writeChapter.mockReset();
		mocks.reviewFull.mockReset();
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("runs write → review → memory and returns the original content when no fix is needed", async () => {
		mocks.writeChapter.mockResolvedValue({ content: "원문", wordCount: 1000 });
		mocks.reviewFull.mockResolvedValue(reviewResult({ needsFix: false }));

		const result = await runWritePipeline(
			1,
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
			[],
		);

		expect(result.wordCount).toBe(1000);
		expect(result.content).toBe("원문");
		// Write + fix should call writeChapter exactly once when fix is skipped.
		expect(mocks.writeChapter).toHaveBeenCalledTimes(1);
	});

	it("calls writeChapter a second time when review needs a fix", async () => {
		mocks.writeChapter
			.mockResolvedValueOnce({ content: "원문".repeat(200), wordCount: 600 })
			.mockResolvedValueOnce({ content: "수정본".repeat(200), wordCount: 600 });
		mocks.reviewFull.mockResolvedValue(
			reviewResult({ needsFix: true, issues: ["issue-1"] }),
		);

		// Pre-create the chapter file so the backup copyFile succeeds.
		await fs.mkdir(path.join(tmpDir, "chapters"), { recursive: true });
		await fs.writeFile(
			path.join(tmpDir, "chapters", "001.md"),
			"원문".repeat(200),
			"utf-8",
		);

		const result = await runWritePipeline(
			1,
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
			[],
		);

		expect(mocks.writeChapter).toHaveBeenCalledTimes(2);
		expect(result.content).toBe("수정본".repeat(200));
	});

	it("restores from .bak and keeps original content when the fix step throws", async () => {
		// Regression: BUG#7 — when the second writeChapter rejects (empty
		// content guard, stream error, etc.) the pipeline used to leave the
		// chapter file empty. The fix restores from .bak.
		const original = "원문".repeat(200);
		mocks.writeChapter
			.mockResolvedValueOnce({ content: original, wordCount: 600 })
			.mockRejectedValueOnce(new Error("ChapterWriter produced empty content"));
		mocks.reviewFull.mockResolvedValue(
			reviewResult({ needsFix: true, issues: ["issue-1"] }),
		);

		await fs.mkdir(path.join(tmpDir, "chapters"), { recursive: true });
		await fs.writeFile(path.join(tmpDir, "chapters", "001.md"), original, "utf-8");

		const result = await runWritePipeline(
			1,
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
			[],
		);

		expect(result.content).toBe(original);
		expect(result.wordCount).toBe(600);
		// Disk file must still contain the original content.
		const onDisk = await fs.readFile(
			path.join(tmpDir, "chapters", "001.md"),
			"utf-8",
		);
		expect(onDisk).toBe(original);
		// A failed fix step must be visible in the step log.
		expect(
			result.steps.some(
				(s) => s.stage === "fix" && s.status === "failed",
			),
		).toBe(true);
	});

	it("restores from .bak when the fix step returns suspiciously short output", async () => {
		// Regression: BUG#7 companion — the second writeChapter resolves but
		// emits a truncated body. The pipeline must detect the shrinkage and
		// roll back rather than persist the half chapter.
		const original = "원문".repeat(200);
		mocks.writeChapter
			.mockResolvedValueOnce({ content: original, wordCount: 600 })
			.mockResolvedValueOnce({ content: "짧음", wordCount: 5 });
		mocks.reviewFull.mockResolvedValue(
			reviewResult({ needsFix: true, issues: ["issue-1"] }),
		);

		await fs.mkdir(path.join(tmpDir, "chapters"), { recursive: true });
		await fs.writeFile(path.join(tmpDir, "chapters", "001.md"), original, "utf-8");

		const result = await runWritePipeline(
			1,
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
			[],
		);

		expect(result.content).toBe(original);
		const onDisk = await fs.readFile(
			path.join(tmpDir, "chapters", "001.md"),
			"utf-8",
		);
		expect(onDisk).toBe(original);
	});

	it("skips the fix step when noFix is set even if review needs a fix", async () => {
		mocks.writeChapter.mockResolvedValue({ content: "원문", wordCount: 1000 });
		mocks.reviewFull.mockResolvedValue(
			reviewResult({ needsFix: true, issues: ["issue-1"] }),
		);

		const result = await runWritePipeline(
			1,
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
			[],
			{ noFix: true },
		);

		expect(mocks.writeChapter).toHaveBeenCalledTimes(1);
		expect(result.content).toBe("원문");
		expect(
			result.steps.some(
				(s) => s.stage === "fix" && s.status === "skipped",
			),
		).toBe(true);
	});

	it("returns immediately after write in raw mode without invoking the reviewer", async () => {
		mocks.writeChapter.mockResolvedValue({ content: "원문", wordCount: 1000 });

		const result = await runWritePipeline(
			1,
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
			[],
			{ raw: true },
		);

		expect(mocks.reviewFull).not.toHaveBeenCalled();
		expect(mocks.writeChapter).toHaveBeenCalledTimes(1);
		expect(result.content).toBe("원문");
	});
});
