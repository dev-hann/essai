import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reviewerMocks = vi.hoisted(() => ({
	review: vi.fn(),
}));

vi.mock("@essai/core", () => ({
	ChapterReviewer: class {
		review = reviewerMocks.review;
	},
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
		chapters: new Map(),
		style: [],
		tone: [],
		constraints: [],
		additionalContext: {},
	}),
}));

import { reviewChapterCommand } from "./review.js";

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

describe("review command", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-review-"));
		reviewerMocks.review.mockReset();
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("reads chapters/NNN.md and passes its content to the reviewer", async () => {
		await writeChapterFile(tmp, 1, "도윤이 카페에서 지아를 만났다");
		reviewerMocks.review.mockResolvedValue("feedback");

		await reviewChapterCommand(1, { cwd: tmp });

		expect(reviewerMocks.review).toHaveBeenCalledWith(
			"도윤이 카페에서 지아를 만났다",
			expect.anything(),
			expect.anything(),
		);
	});

	it("prints the feedback to stdout", async () => {
		await writeChapterFile(tmp, 1, "본문");
		reviewerMocks.review.mockResolvedValue(
			"대화가 자연스럽다. 감정선을 보강하라.",
		);

		const out = newCapture();
		await reviewChapterCommand(1, { cwd: tmp, stdout: out });

		expect(out.output).toContain("대화가 자연스럽다. 감정선을 보강하라.");
	});

	it("loads the rules file and forwards it to the reviewer when --rules is set", async () => {
		await writeChapterFile(tmp, 1, "본문");
		await fs.writeFile(
			path.join(tmp, "rules.md"),
			"Each scene must end on a question.",
			"utf-8",
		);
		reviewerMocks.review.mockResolvedValue("ok");

		await reviewChapterCommand(1, {
			cwd: tmp,
			rules: path.join(tmp, "rules.md"),
		});

		expect(reviewerMocks.review).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				rules: "Each scene must end on a question.",
			}),
		);
	});

	it("throws when the chapter file does not exist", async () => {
		reviewerMocks.review.mockResolvedValue("ok");

		await expect(reviewChapterCommand(99, { cwd: tmp })).rejects.toThrow();
		expect(reviewerMocks.review).not.toHaveBeenCalled();
	});

	it("throws when the rules file cannot be read", async () => {
		await writeChapterFile(tmp, 1, "x");

		await expect(
			reviewChapterCommand(1, {
				cwd: tmp,
				rules: path.join(tmp, "missing.md"),
			}),
		).rejects.toThrow();
	});
});
