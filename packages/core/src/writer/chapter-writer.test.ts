import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	streamText: vi.fn(),
}));

vi.mock("ai", () => ({
	streamText: mocks.streamText,
}));

import type { BibleData } from "../bible/types.js";
import type { ProjectConfig } from "../config/project-config.js";
import type { ProjectConfigData } from "../config/schema.js";
import type { ChapterMemory } from "../memory/types.js";
import { ChapterWriter } from "./chapter-writer.js";

function sampleConfigData(
	overrides: Partial<ProjectConfigData> = {},
): ProjectConfigData {
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
		...overrides,
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
		characters: { 도윤: { 나이: "25" } },
		relationships: [],
		emotion: [],
		chapters: new Map([
			[1, { number: 1, title: "첫 만남", scenes: ["카페에서 만남"] }],
		]),
		style: [],
		tone: [],
		constraints: [],
		additionalContext: {},
	};
}

function sampleMemory(): ChapterMemory {
	return {
		chapter: 1,
		title: "첫 만남",
		wordCount: 3000,
		events: ["도윤이 지아를 만남"],
		emotions: [],
		foreshadowing: [],
		facts: ["지아는 대만에서 왔다"],
		characterState: {},
	};
}

async function* chunks(parts: string[]): AsyncGenerator<string> {
	for (const p of parts) yield p;
}

function mockStreamResult(parts: string[]) {
	mocks.streamText.mockResolvedValue({
		textStream: chunks(parts),
	});
}

describe("ChapterWriter", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "essai-writer-"));
		mocks.streamText.mockReset();
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("calls streamText with the model built from config and prompts from bible", async () => {
		mockStreamResult(["한", "글", "내용"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		await writer.writeChapter(1);

		expect(mocks.streamText).toHaveBeenCalledTimes(1);
		const call = mocks.streamText.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(call).toBeDefined();
		expect(call.model).toBeDefined();
		expect(typeof call.system).toBe("string");
		expect((call.system as string).length).toBeGreaterThan(0);
		expect(typeof call.prompt).toBe("string");
		expect((call.prompt as string).length).toBeGreaterThan(0);
	});

	it("passes temperature and maxTokens from config to streamText", async () => {
		mockStreamResult(["text"]);

		const data = sampleConfigData();
		const writer = new ChapterWriter(newConfig(data), sampleBible(), tmpDir);
		await writer.writeChapter(1);

		const call = mocks.streamText.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(call.temperature).toBe(0.7);
		expect(call.maxOutputTokens).toBe(8000);
	});

	it("embeds the chapter plan and language in the prompt", async () => {
		mockStreamResult(["text"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		await writer.writeChapter(1);

		const call = mocks.streamText.mock.calls[0]?.[0] as { prompt: string };
		expect(call.prompt).toContain("첫 만남");
		expect(call.prompt).toContain("ko");
		expect(call.prompt).toContain("3000");
	});

	it("collects stream chunks into a single content string", async () => {
		mockStreamResult(["한글", "내용", "입니다"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		const result = await writer.writeChapter(1);

		expect(result.content).toBe("한글내용입니다");
	});

	it("counts characters (not whitespace-split words) for wordCount", async () => {
		mockStreamResult(["한글내용"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		const result = await writer.writeChapter(1);

		expect(result.wordCount).toBe(4);
	});

	it("writes the collected content to chapters/NNN.md with zero padding", async () => {
		mockStreamResult(["챕터", "내용"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		await writer.writeChapter(7);

		const file = path.join(tmpDir, "chapters", "007.md");
		const written = await fs.readFile(file, "utf-8");
		expect(written).toBe("챕터내용");
	});

	it("creates the chapters directory if it does not exist", async () => {
		mockStreamResult(["x"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		await writer.writeChapter(1);

		const stat = await fs.stat(path.join(tmpDir, "chapters"));
		expect(stat.isDirectory()).toBe(true);
	});

	it("forwards instruction into the prompt when provided", async () => {
		mockStreamResult(["text"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		await writer.writeChapter(1, { instruction: "대화를 더 늘려" });

		const call = mocks.streamText.mock.calls[0]?.[0] as { prompt: string };
		expect(call.prompt).toContain("대화를 더 늘려");
	});

	it("forwards memory summaries into the prompt when provided", async () => {
		mockStreamResult(["text"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		await writer.writeChapter(2, { memorySummaries: [sampleMemory()] });

		const call = mocks.streamText.mock.calls[0]?.[0] as { prompt: string };
		expect(call.prompt).toContain("지아는 대만에서 왔다");
	});

	it("invokes onToken for each streamed delta", async () => {
		mockStreamResult(["a", "b", "c"]);

		const writer = new ChapterWriter(
			newConfig(sampleConfigData()),
			sampleBible(),
			tmpDir,
		);
		const seen: string[] = [];
		await writer.writeChapter(1, { onToken: (delta) => seen.push(delta) });

		expect(seen).toEqual(["a", "b", "c"]);
	});

	it("defaults projectDir to the current working directory", async () => {
		const cwd = process.cwd();
		try {
			process.chdir(tmpDir);
			mockStreamResult(["content"]);

			const writer = new ChapterWriter(
				newConfig(sampleConfigData()),
				sampleBible(),
			);
			await writer.writeChapter(1);

			const written = await fs.readFile(
				path.join(tmpDir, "chapters", "001.md"),
				"utf-8",
			);
			expect(written).toBe("content");
		} finally {
			process.chdir(cwd);
		}
	});
});
