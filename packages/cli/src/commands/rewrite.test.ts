import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const editorMocks = vi.hoisted(() => ({
	rewrite: vi.fn(),
	partialRewrite: vi.fn(),
}));

const summarizerMocks = vi.hoisted(() => ({
	summarize: vi.fn(),
}));

const memoryMocks = vi.hoisted(() => ({
	loadRecent: vi.fn(),
	save: vi.fn(),
}));

vi.mock("@essai/core", () => ({
	ChapterEditor: class {
		rewrite = editorMocks.rewrite;
		partialRewrite = editorMocks.partialRewrite;
	},
	ChapterWriter: class {},
	Summarizer: class {
		summarize = summarizerMocks.summarize;
	},
	MemoryStore: class {
		loadRecent = memoryMocks.loadRecent;
		save = memoryMocks.save;
	},
	parseAliasesFromCharactersMd: () => ({}),
	resolveCharacterAliases: (memories: unknown) => memories,
	ProjectConfig: {
		load: vi.fn().mockResolvedValue({
			name: "demo",
			language: "ko",
			chapterWords: 3000,
			llm: {
				baseUrl: "https://api.example.com/v4",
				apiKey: "secret",
				model: "glm-5.1",
				temperature: 0.7,
				maxTokens: 8000,
				thinkingEnabled: false,
			},
			toJSON: () => ({}),
		}),
	},
	loadBible: vi.fn().mockResolvedValue({
		characters: {},
		relationships: [],
		emotion: [],
		chapters: new Map([
			[1, { number: 1, title: "첫 만남", scenes: [] }],
			[2, { number: 2, title: "두 번째", scenes: [] }],
			[3, { number: 3, title: "세 번째", scenes: [] }],
		]),
		style: [],
		tone: [],
		constraints: [],
		additionalContext: {},
	}),
}));

import { rewriteChapterCommand } from "./rewrite.js";

interface Captured {
	output: string;
	write(chunk: string): void;
}

function newCapture(): Captured {
	let output = "";
	return {
		get output() {
			return output;
		},
		write(chunk: string) {
			output += chunk;
		},
	};
}

function memoryJson(chapter: number) {
	return {
		chapter,
		title: `Chapter ${chapter}`,
		wordCount: 1,
		events: [],
		emotions: [],
		foreshadowing: [],
		facts: [],
		characterState: {},
	};
}

describe("rewrite command", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-rewrite-"));
		editorMocks.rewrite.mockReset();
		editorMocks.partialRewrite.mockReset();
		summarizerMocks.summarize.mockReset();
		memoryMocks.loadRecent.mockReset();
		memoryMocks.save.mockReset();
		memoryMocks.loadRecent.mockResolvedValue([]);
		memoryMocks.save.mockResolvedValue(undefined);
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("delegates to ChapterEditor.rewrite with the chapter number", async () => {
		editorMocks.rewrite.mockResolvedValue({ content: "x", wordCount: 1 });
		summarizerMocks.summarize.mockResolvedValue(memoryJson(1));

		await rewriteChapterCommand(1, { cwd: tmp });

		expect(editorMocks.rewrite).toHaveBeenCalledTimes(1);
		expect(editorMocks.rewrite.mock.calls[0]?.[0]).toBe(1);
	});

	it("passes instruction through to the editor", async () => {
		editorMocks.rewrite.mockResolvedValue({ content: "x", wordCount: 1 });
		summarizerMocks.summarize.mockResolvedValue(memoryJson(1));

		await rewriteChapterCommand(1, {
			cwd: tmp,
			instruction: "대화를 더 늘려",
		});

		const opts = editorMocks.rewrite.mock.calls[0]?.[1];
		expect(opts).toEqual(
			expect.objectContaining({ instruction: "대화를 더 늘려" }),
		);
	});

	it("injects recent memory summaries into the editor", async () => {
		memoryMocks.loadRecent.mockResolvedValue([memoryJson(1)]);
		editorMocks.rewrite.mockResolvedValue({ content: "x", wordCount: 1 });
		summarizerMocks.summarize.mockResolvedValue(memoryJson(2));

		await rewriteChapterCommand(2, { cwd: tmp });

		const opts = editorMocks.rewrite.mock.calls[0]?.[1];
		expect(opts.memorySummaries).toEqual(
			expect.arrayContaining([expect.objectContaining({ chapter: 1 })]),
		);
	});

	it("streams tokens to stdout via onToken", async () => {
		editorMocks.rewrite.mockImplementation(
			async (_n: number, opts: { onToken?: (d: string) => void }) => {
				opts.onToken?.("한");
				opts.onToken?.("글");
				return { content: "한글", wordCount: 2 };
			},
		);
		summarizerMocks.summarize.mockResolvedValue(memoryJson(1));

		const out = newCapture();
		await rewriteChapterCommand(1, { cwd: tmp, stdout: out });

		expect(out.output).toContain("한글");
	});

	it("regenerates and saves the memory for the rewritten chapter", async () => {
		editorMocks.rewrite.mockResolvedValue({ content: "x", wordCount: 1 });
		const memory = memoryJson(2);
		summarizerMocks.summarize.mockResolvedValue(memory);

		await rewriteChapterCommand(2, { cwd: tmp });

		expect(summarizerMocks.summarize).toHaveBeenCalledTimes(1);
		expect(summarizerMocks.summarize.mock.calls[0]?.[0]).toBe(2);
		expect(memoryMocks.save).toHaveBeenCalledTimes(1);
	});

	it("prints the final word count line", async () => {
		editorMocks.rewrite.mockResolvedValue({
			content: "본문",
			wordCount: 2500,
		});
		summarizerMocks.summarize.mockResolvedValue(memoryJson(1));

		const out = newCapture();
		await rewriteChapterCommand(1, { cwd: tmp, stdout: out });

		expect(out.output).toContain("2500");
		expect(out.output).toMatch(/rewritten/i);
	});

	it("throws when the chapter plan is missing from the bible", async () => {
		const { loadBible } = await import("@essai/core");
		vi.mocked(loadBible).mockResolvedValueOnce({
			characters: {},
			relationships: [],
			emotion: [],
			chapters: new Map(),
			style: [],
			tone: [],
			constraints: [],
			additionalContext: {},
		});

		await expect(rewriteChapterCommand(99, { cwd: tmp })).rejects.toThrow();
		expect(editorMocks.rewrite).not.toHaveBeenCalled();
	});

	it("creates a .bak of the existing chapter before rewriting", async () => {
		// Regression: standalone rewrite used to overwrite the file with no
		// recovery path. Now it copies the original to .bak first.
		const chaptersDir = path.join(tmp, "chapters");
		await fs.mkdir(chaptersDir, { recursive: true });
		const original = "원본 콘텐츠";
		await fs.writeFile(path.join(chaptersDir, "001.md"), original, "utf-8");

		editorMocks.rewrite.mockResolvedValue({
			content: "새 콘텐츠",
			wordCount: 5,
		});
		summarizerMocks.summarize.mockResolvedValue(memoryJson(1));

		await rewriteChapterCommand(1, { cwd: tmp });

		const backup = await fs.readFile(
			path.join(chaptersDir, "001.md.bak"),
			"utf-8",
		);
		expect(backup).toBe(original);
	});

	it("restores the original chapter when rewrite throws", async () => {
		// Regression: when ChapterWriter's empty-content guard fires during
		// a rewrite, the command must restore the .bak so the author does
		// not lose the prior chapter.
		const chaptersDir = path.join(tmp, "chapters");
		await fs.mkdir(chaptersDir, { recursive: true });
		const original = "원본 콘텐츠";
		await fs.writeFile(path.join(chaptersDir, "001.md"), original, "utf-8");

		editorMocks.rewrite.mockRejectedValue(
			new Error("ChapterWriter produced empty content"),
		);
		summarizerMocks.summarize.mockResolvedValue(memoryJson(1));

		await expect(rewriteChapterCommand(1, { cwd: tmp })).rejects.toThrow(
			/empty content/i,
		);

		const onDisk = await fs.readFile(path.join(chaptersDir, "001.md"), "utf-8");
		expect(onDisk).toBe(original);
	});
});
