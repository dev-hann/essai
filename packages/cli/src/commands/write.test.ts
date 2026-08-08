import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writerMocks = vi.hoisted(() => ({
	writeChapter: vi.fn(),
}));

const summarizerMocks = vi.hoisted(() => ({
	summarize: vi.fn(),
}));

const memoryMocks = vi.hoisted(() => ({
	loadRecent: vi.fn(),
	save: vi.fn(),
}));

const pipelineMocks = vi.hoisted(() => ({
	run: vi.fn(),
}));

vi.mock("@essai/core", () => ({
	ChapterWriter: class {
		writeChapter = writerMocks.writeChapter;
	},
	Summarizer: class {
		summarize = summarizerMocks.summarize;
	},
	MemoryStore: class {
		loadRecent = memoryMocks.loadRecent;
		save = memoryMocks.save;
	},
	parseAliasesFromCharactersMd: () => ({}),
	resolveCharacterAliases: (memories: unknown) => memories,
	runWritePipeline: pipelineMocks.run,
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
			toJSON: () => ({
				name: "demo",
				language: "ko",
				chapterWords: 3000,
				llm: { model: "glm-5.1" },
			}),
		}),
	},
	loadBible: vi.fn().mockResolvedValue({
		characters: {},
		relationships: [],
		emotion: [],
		chapters: new Map([
			[1, { number: 1, title: "첫 만남", scenes: [] }],
			[2, { number: 2, title: "두 번째", scenes: [] }],
		]),
		style: [],
		tone: [],
		constraints: [],
		additionalContext: {},
	}),
}));

import { resolveChapterNumber, writeChapterCommand } from "./write.js";

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

const sampleMemory = {
	chapter: 1,
	title: "첫 만남",
	wordCount: 2,
	events: [] as string[],
	emotions: [] as string[],
	foreshadowing: [] as string[],
	facts: [] as string[],
	characterState: {} as Record<string, unknown>,
};

describe("write command", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-write-"));
		writerMocks.writeChapter.mockReset();
		summarizerMocks.summarize.mockReset();
		memoryMocks.loadRecent.mockReset();
		memoryMocks.loadRecent.mockResolvedValue([]);
		memoryMocks.save.mockReset();
		memoryMocks.save.mockResolvedValue(undefined);
		pipelineMocks.run.mockReset();
		pipelineMocks.run.mockResolvedValue({
			chapter: 1,
			steps: [],
			content: "본문",
			wordCount: 2,
		});
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	describe("resolveChapterNumber", () => {
		it("returns the parsed integer when a number is given", () => {
			expect(resolveChapterNumber(5, [])).toBe(5);
		});

		it("returns 1 when 'next' is requested with no existing chapters", () => {
			expect(resolveChapterNumber("next", [])).toBe(1);
		});

		it("returns the chapter after the highest existing chapter for 'next'", () => {
			expect(resolveChapterNumber("next", ["001.md", "003.md"])).toBe(4);
		});

		it("zero-pads higher than 999 gracefully", () => {
			expect(resolveChapterNumber("next", ["999.md"])).toBe(1000);
		});
	});

	describe("writeChapterCommand", () => {
		it("calls runWritePipeline by default with the resolved chapter number", async () => {
			pipelineMocks.run.mockResolvedValue({
				chapter: 1,
				steps: [],
				content: "본문",
				wordCount: 2,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			await writeChapterCommand(1, { cwd: tmp });

			expect(pipelineMocks.run).toHaveBeenCalledWith(
				1,
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.anything(),
			);
			expect(writerMocks.writeChapter).not.toHaveBeenCalled();
		});

		it("streams deltas to stdout via onToken in raw mode", async () => {
			writerMocks.writeChapter.mockImplementation(
				async (_n: number, opts: { onToken?: (d: string) => void }) => {
					opts.onToken?.("a");
					opts.onToken?.("b");
					return { content: "ab", wordCount: 2 };
				},
			);
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			const out = newCapture();
			await writeChapterCommand(1, { cwd: tmp, stdout: out, raw: true });

			expect(out.output).toContain("ab");
			expect(pipelineMocks.run).not.toHaveBeenCalled();
		});

		it("passes instruction through to writeChapter in raw mode", async () => {
			writerMocks.writeChapter.mockResolvedValue({
				content: "x",
				wordCount: 1,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			await writeChapterCommand(1, {
				cwd: tmp,
				raw: true,
				instruction: "대화를 더 늘려",
			});

			expect(writerMocks.writeChapter).toHaveBeenCalledWith(
				1,
				expect.objectContaining({ instruction: "대화를 더 늘려" }),
			);
		});

		it("auto-generates a memory summary after writing", async () => {
			pipelineMocks.run.mockResolvedValue({
				chapter: 1,
				steps: [],
				content: "본문",
				wordCount: 2,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			await writeChapterCommand(1, { cwd: tmp });

			expect(summarizerMocks.summarize).toHaveBeenCalledTimes(1);
			expect(summarizerMocks.summarize).toHaveBeenCalledWith(
				1,
				"첫 만남",
				"본문",
				expect.anything(),
			);
		});

		it("prints the final word count line after writing", async () => {
			pipelineMocks.run.mockResolvedValue({
				chapter: 1,
				steps: [],
				content: "본문",
				wordCount: 3021,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			const out = newCapture();
			await writeChapterCommand(1, { cwd: tmp, stdout: out });

			expect(out.output).toContain("3021");
			expect(out.output).toContain("Chapter 1");
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

			await expect(writeChapterCommand(99, { cwd: tmp })).rejects.toThrow();
		});

		it("resolves 'next' to latest+1 and still injects memory", async () => {
			const { loadBible } = await import("@essai/core");
			vi.mocked(loadBible).mockResolvedValueOnce({
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
			});
			await fs.mkdir(path.join(tmp, "chapters"));
			await fs.writeFile(
				path.join(tmp, "chapters", "001.md"),
				"prior",
				"utf-8",
			);
			await fs.writeFile(
				path.join(tmp, "chapters", "002.md"),
				"prior",
				"utf-8",
			);
			memoryMocks.loadRecent.mockResolvedValue([
				{
					chapter: 2,
					title: "두 번째",
					wordCount: 5,
					events: ["이전 사건"],
					emotions: [],
					foreshadowing: [],
					facts: ["사실"],
					characterState: {},
				},
			]);
			pipelineMocks.run.mockResolvedValue({
				chapter: 3,
				steps: [],
				content: "3화 본문",
				wordCount: 5,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			await writeChapterCommand("next", { cwd: tmp });

			expect(pipelineMocks.run).toHaveBeenCalledWith(
				3,
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.arrayContaining([expect.objectContaining({ chapter: 2 })]),
				expect.anything(),
			);
		});

		it("with raw option, calls ChapterWriter directly and bypasses the pipeline", async () => {
			writerMocks.writeChapter.mockResolvedValue({
				content: "raw content",
				wordCount: 11,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			await writeChapterCommand(1, { cwd: tmp, raw: true });

			expect(writerMocks.writeChapter).toHaveBeenCalledWith(
				1,
				expect.anything(),
			);
			expect(pipelineMocks.run).not.toHaveBeenCalled();
		});

		it("with raw option, noFix is ignored (pipeline not invoked)", async () => {
			writerMocks.writeChapter.mockResolvedValue({
				content: "raw content",
				wordCount: 11,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			await writeChapterCommand(1, { cwd: tmp, raw: true, noFix: true });

			expect(pipelineMocks.run).not.toHaveBeenCalled();
			expect(writerMocks.writeChapter).toHaveBeenCalled();
		});

		it("with noFix option, passes noFix through to the pipeline", async () => {
			pipelineMocks.run.mockResolvedValue({
				chapter: 1,
				steps: [],
				content: "본문",
				wordCount: 2,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			await writeChapterCommand(1, { cwd: tmp, noFix: true });

			expect(pipelineMocks.run).toHaveBeenCalledTimes(1);
			expect(pipelineMocks.run).toHaveBeenCalledWith(
				1,
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.anything(),
				expect.objectContaining({ noFix: true }),
			);
		});

		it("without noFix, does not set noFix on the pipeline options", async () => {
			pipelineMocks.run.mockResolvedValue({
				chapter: 1,
				steps: [],
				content: "본문",
				wordCount: 2,
			});
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			await writeChapterCommand(1, { cwd: tmp });

			expect(pipelineMocks.run).toHaveBeenCalledTimes(1);
			const callArgs = pipelineMocks.run.mock.calls[0];
			const optionsArg = callArgs?.[callArgs.length - 1];
			expect(optionsArg).not.toMatchObject({ noFix: true });
		});

		it("streams pipeline step progress to stdout", async () => {
			pipelineMocks.run.mockImplementation(
				async (
					_chapter: number,
					_config: unknown,
					_bible: unknown,
					_dir: string,
					_mem: unknown,
					opts: {
						onProgress?: (s: { stage: string; message: string }) => void;
					},
				) => {
					opts.onProgress?.({
						stage: "review",
						message: "Review complete",
					});
					return {
						chapter: 1,
						steps: [],
						content: "본문",
						wordCount: 2,
					};
				},
			);
			summarizerMocks.summarize.mockResolvedValue({ ...sampleMemory });

			const out = newCapture();
			await writeChapterCommand(1, { cwd: tmp, stdout: out });

			expect(out.output).toContain("[review]");
			expect(out.output).toContain("Review complete");
		});
	});
});
