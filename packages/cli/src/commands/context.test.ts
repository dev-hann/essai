import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryMocks = vi.hoisted(() => ({
	loadRecent: vi.fn(),
}));

vi.mock("@essai/core", () => ({
	MemoryStore: class {
		loadRecent = memoryMocks.loadRecent;
	},
	loadBible: vi.fn().mockResolvedValue({
		characters: { 도윤: { 나이: "25" } },
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

import { buildContextPreview, contextCommand } from "./context.js";

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

function memory(chapter: number, overrides: Record<string, unknown> = {}) {
	return {
		chapter,
		title: `Chapter ${chapter}`,
		wordCount: 1000,
		events: [`event-${chapter}`],
		emotions: [],
		foreshadowing: [],
		facts: [],
		characterState: {},
		...overrides,
	};
}

describe("context command", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-context-"));
		memoryMocks.loadRecent.mockReset();
		memoryMocks.loadRecent.mockResolvedValue([]);
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	describe("buildContextPreview", () => {
		it("returns an empty preview when no memories exist", async () => {
			const preview = await buildContextPreview(5, { cwd: tmp });

			expect(preview.chapter).toBe(5);
			expect(preview.recentSummaries).toEqual([]);
			expect(preview.unresolvedForeshadowing).toEqual([]);
			expect(preview.characterState).toEqual({});
			expect(preview.estimatedTokens).toBe(0);
		});

		it("pulls the recent summaries from the memory store", async () => {
			memoryMocks.loadRecent.mockResolvedValue([
				memory(2),
				memory(3),
				memory(4),
			]);

			const preview = await buildContextPreview(5, { cwd: tmp });

			expect(preview.recentSummaries.map((m) => m.chapter)).toEqual([2, 3, 4]);
		});

		it("collects unresolved and active foreshadowing across recent memories", async () => {
			memoryMocks.loadRecent.mockResolvedValue([
				memory(2, {
					foreshadowing: [
						{
							item: "지아의 우산",
							status: "unresolved",
							chapterIntroduced: 1,
						},
						{
							item: "해결된 복선",
							status: "resolved",
							chapterIntroduced: 1,
						},
					],
				}),
				memory(3, {
					foreshadowing: [
						{
							item: "편지 봉투",
							status: "active",
							chapterIntroduced: 2,
						},
					],
				}),
			]);

			const preview = await buildContextPreview(4, { cwd: tmp });

			const items = preview.unresolvedForeshadowing.map((f) => f.item);
			expect(items).toContain("지아의 우산");
			expect(items).toContain("편지 봉투");
			expect(items).not.toContain("해결된 복선");
		});

		it("merges the latest characterState across recent memories", async () => {
			memoryMocks.loadRecent.mockResolvedValue([
				memory(2, {
					characterState: {
						도윤: { location: "카페", mood: "호기심", knows: [] },
					},
				}),
				memory(3, {
					characterState: {
						도윤: { location: "공원", mood: "안도", knows: ["지아"] },
						지아: { location: "공원", mood: "편안", knows: [] },
					},
				}),
			]);

			const preview = await buildContextPreview(4, { cwd: tmp });

			expect(preview.characterState.도윤?.location).toBe("공원");
			expect(preview.characterState.지아?.mood).toBe("편안");
		});

		it("estimates a positive token budget when memories exist", async () => {
			memoryMocks.loadRecent.mockResolvedValue([
				memory(2, { events: ["긴 사건 설명이 여기 들어간다"] }),
			]);

			const preview = await buildContextPreview(3, { cwd: tmp });

			expect(preview.estimatedTokens).toBeGreaterThan(0);
		});

		it("does not call any LLM (read-only)", async () => {
			memoryMocks.loadRecent.mockResolvedValue([memory(1)]);

			await buildContextPreview(2, { cwd: tmp });

			// loadRecent is the only call; no generateText/streamText invoked
			expect(memoryMocks.loadRecent).toHaveBeenCalledTimes(1);
		});
	});

	describe("contextCommand", () => {
		it("prints the chapter number header", async () => {
			const out = newCapture();
			await contextCommand(5, { cwd: tmp, stdout: out });

			expect(out.output).toContain("Chapter 5");
		});

		it("prints each recent summary chapter and title", async () => {
			memoryMocks.loadRecent.mockResolvedValue([
				memory(2, { title: "두 번째" }),
				memory(3, { title: "세 번째" }),
			]);

			const out = newCapture();
			await contextCommand(4, { cwd: tmp, stdout: out });

			expect(out.output).toContain("두 번째");
			expect(out.output).toContain("세 번째");
		});

		it("prints unresolved foreshadowing items", async () => {
			memoryMocks.loadRecent.mockResolvedValue([
				memory(2, {
					foreshadowing: [
						{
							item: "지아의 우산",
							status: "unresolved",
							chapterIntroduced: 1,
						},
					],
				}),
			]);

			const out = newCapture();
			await contextCommand(3, { cwd: tmp, stdout: out });

			expect(out.output).toContain("지아의 우산");
		});

		it("prints the estimated token count", async () => {
			memoryMocks.loadRecent.mockResolvedValue([
				memory(2, { events: ["긴 사건 설명"] }),
			]);

			const out = newCapture();
			await contextCommand(3, { cwd: tmp, stdout: out });

			expect(out.output).toMatch(/tokens/i);
		});

		it("prints a helpful message when there is no memory yet", async () => {
			const out = newCapture();
			await contextCommand(1, { cwd: tmp, stdout: out });

			expect(out.output).toMatch(/no memory|nothing/i);
		});
	});
});
