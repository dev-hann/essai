import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryMocks = vi.hoisted(() => ({
	loadRecent: vi.fn(),
}));

vi.mock("@essai/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@essai/core")>();
	return {
		...actual,
		MemoryStore: class {
			loadRecent = memoryMocks.loadRecent;
		},
		loadBible: vi.fn(),
	};
});

import { loadBible } from "@essai/core";
import { showStatus } from "./status.js";

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

async function writeChapterFile(
	dir: string,
	n: number,
	content: string,
): Promise<void> {
	const chaptersDir = path.join(dir, "chapters");
	await fs.mkdir(chaptersDir, { recursive: true });
	const name = n.toString().padStart(3, "0");
	await fs.writeFile(path.join(chaptersDir, `${name}.md`), content, "utf-8");
}

function emptyBible() {
	return {
		characters: {},
		relationships: [],
		emotion: [],
		chapters: new Map([
			[1, { number: 1, title: "첫 만남", scenes: [] }],
			[2, { number: 2, title: "두 번째", scenes: [] }],
			[3, { number: 3, title: "세 번째", scenes: [] }],
			[4, { number: 4, title: "네 번째", scenes: [] }],
			[5, { number: 5, title: "다섯 번째", scenes: [] }],
		]),
		style: [],
		tone: [],
		constraints: [],
		additionalContext: {},
	};
}

function bibleWithEmotion() {
	const bible = emptyBible();
	bible.emotion = [
		{
			stage: 1,
			name: "경계",
			chapters: "1~3화",
			emotions: {},
		},
		{
			stage: 2,
			name: "접근",
			chapters: "4~5화",
			emotions: {},
		},
	];
	return bible;
}

describe("showStatus enhancements", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-status2-"));
		memoryMocks.loadRecent.mockReset();
		memoryMocks.loadRecent.mockResolvedValue([]);
		vi.mocked(loadBible).mockReset();
		vi.mocked(loadBible).mockResolvedValue(emptyBible());
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	describe("total word count", () => {
		it("reports the total character count across written chapters", async () => {
			await writeChapterFile(tmp, 1, "ab");
			await writeChapterFile(tmp, 2, "abcde");

			const out = newCapture();
			await showStatus({ cwd: tmp, stdout: out });

			expect(out.output).toContain("Total characters: 7");
		});

		it("reports zero total characters when no chapters are written", async () => {
			const out = newCapture();
			await showStatus({ cwd: tmp, stdout: out });

			expect(out.output).toContain("Total characters: 0");
		});
	});

	describe("emotion stage", () => {
		it("reports the emotion stage matching the next chapter", async () => {
			vi.mocked(loadBible).mockResolvedValueOnce(bibleWithEmotion());

			const out = newCapture();
			await showStatus({ cwd: tmp, stdout: out });

			// Next chapter is 1, which falls in stage 1 "경계"
			expect(out.output).toContain("Emotion stage:");
			expect(out.output).toContain("경계");
		});

		it("reports the updated emotion stage after chapters are written", async () => {
			vi.mocked(loadBible).mockResolvedValueOnce(bibleWithEmotion());
			await writeChapterFile(tmp, 1, "x");
			await writeChapterFile(tmp, 2, "x");
			await writeChapterFile(tmp, 3, "x");

			const out = newCapture();
			await showStatus({ cwd: tmp, stdout: out });

			// Next is chapter 4, stage 2 "접근"
			expect(out.output).toContain("접근");
		});

		it("omits the emotion stage line when the bible has no emotion curve", async () => {
			const out = newCapture();
			await showStatus({ cwd: tmp, stdout: out });

			expect(out.output).not.toContain("Emotion stage:");
		});
	});

	describe("unresolved foreshadowing", () => {
		it("reports zero unresolved foreshadowing when no memory exists", async () => {
			const out = newCapture();
			await showStatus({ cwd: tmp, stdout: out });

			expect(out.output).toContain("Unresolved foreshadowing: 0");
		});

		it("counts unresolved and active foreshadowing across recent memories", async () => {
			memoryMocks.loadRecent.mockResolvedValue([
				{
					chapter: 1,
					title: "t1",
					wordCount: 0,
					events: [],
					emotions: [],
					foreshadowing: [
						{
							item: "우산",
							status: "unresolved",
							chapterIntroduced: 1,
						},
						{
							item: "해결됨",
							status: "resolved",
							chapterIntroduced: 1,
						},
					],
					facts: [],
					characterState: {},
				},
				{
					chapter: 2,
					title: "t2",
					wordCount: 0,
					events: [],
					emotions: [],
					foreshadowing: [
						{
							item: "편지",
							status: "active",
							chapterIntroduced: 2,
						},
					],
					facts: [],
					characterState: {},
				},
			]);

			const out = newCapture();
			await showStatus({ cwd: tmp, stdout: out });

			expect(out.output).toContain("Unresolved foreshadowing: 2");
		});
	});

	describe("legacy fields preserved", () => {
		it("still reports chapters written, next, and planned count", async () => {
			await writeChapterFile(tmp, 1, "abc");

			const out = newCapture();
			await showStatus({ cwd: tmp, stdout: out });

			expect(out.output).toContain("Chapters written: 1");
			expect(out.output).toContain("Next: 2");
			expect(out.output).toContain("Planned chapters: 5");
		});
	});
});
