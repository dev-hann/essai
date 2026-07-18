import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	generateText: vi.fn(),
}));

vi.mock("ai", () => ({
	generateText: mocks.generateText,
}));

import type { BibleData } from "../bible/types.js";
import type { ProjectConfig } from "../config/project-config.js";
import type { ProjectConfigData } from "../config/schema.js";
import { ChapterReviewer } from "./chapter-reviewer.js";

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
		style: ["colloquial"],
		tone: ["gentle"],
		constraints: ["no new characters"],
		additionalContext: {},
	};
}

describe("ChapterReviewer", () => {
	beforeEach(() => {
		mocks.generateText.mockReset();
	});

	it("calls generateText with the model built from config", async () => {
		mocks.generateText.mockResolvedValue({ text: "looks good" });

		const reviewer = new ChapterReviewer(newConfig(sampleConfigData()));
		await reviewer.review("챕터 본문", sampleBible());

		expect(mocks.generateText).toHaveBeenCalledTimes(1);
		const call = mocks.generateText.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(call.model).toBeDefined();
	});

	it("returns the feedback string from the model", async () => {
		mocks.generateText.mockResolvedValue({
			text: "대화가 자연스럽지만 감정선이 얇다.",
		});

		const reviewer = new ChapterReviewer(newConfig(sampleConfigData()));
		const feedback = await reviewer.review("본문", sampleBible());

		expect(feedback).toBe("대화가 자연스럽지만 감정선이 얇다.");
	});

	it("includes the chapter content in the prompt", async () => {
		mocks.generateText.mockResolvedValue({ text: "ok" });

		const reviewer = new ChapterReviewer(newConfig(sampleConfigData()));
		await reviewer.review("도윤이 카페에 앉아 있었다", sampleBible());

		const call = mocks.generateText.mock.calls[0]?.[0] as { prompt: string };
		expect(call.prompt).toContain("도윤이 카페에 앉아 있었다");
	});

	it("includes style, tone, and constraints from the bible in the system prompt", async () => {
		mocks.generateText.mockResolvedValue({ text: "ok" });

		const reviewer = new ChapterReviewer(newConfig(sampleConfigData()));
		await reviewer.review("x", sampleBible());

		const call = mocks.generateText.mock.calls[0]?.[0] as { system: string };
		expect(call.system).toContain("colloquial");
		expect(call.system).toContain("gentle");
		expect(call.system).toContain("no new characters");
	});

	it("writes the language directive in the configured language", async () => {
		mocks.generateText.mockResolvedValue({ text: "ok" });

		const reviewer = new ChapterReviewer(
			newConfig(sampleConfigData({ language: "ko" })),
		);
		await reviewer.review("x", sampleBible());

		const call = mocks.generateText.mock.calls[0]?.[0] as { system: string };
		expect(call.system).toContain("ko");
	});

	it("passes temperature and maxTokens from config", async () => {
		mocks.generateText.mockResolvedValue({ text: "ok" });

		const reviewer = new ChapterReviewer(newConfig(sampleConfigData()));
		await reviewer.review("x", sampleBible());

		const call = mocks.generateText.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(call.temperature).toBe(0.7);
		expect(call.maxOutputTokens).toBe(8000);
	});

	it("incorporates custom rules into the system prompt when provided", async () => {
		mocks.generateText.mockResolvedValue({ text: "ok" });

		const reviewer = new ChapterReviewer(newConfig(sampleConfigData()));
		await reviewer.review("x", sampleBible(), {
			rules: "Each scene must end on a question.",
		});

		const call = mocks.generateText.mock.calls[0]?.[0] as { system: string };
		expect(call.system).toContain("Each scene must end on a question.");
	});

	it("never returns a numeric score, only prose feedback", async () => {
		mocks.generateText.mockResolvedValue({ text: "prose feedback" });

		const reviewer = new ChapterReviewer(newConfig(sampleConfigData()));
		const feedback = await reviewer.review("x", sampleBible());

		expect(typeof feedback).toBe("string");
		expect(Number.isFinite(Number(feedback))).toBe(false);
	});

	it("does not reject — returns feedback even when critical", async () => {
		mocks.generateText.mockResolvedValue({
			text: "This chapter fails every constraint.",
		});

		const reviewer = new ChapterReviewer(newConfig(sampleConfigData()));
		const feedback = await reviewer.review("x", sampleBible());

		expect(feedback).toContain("fails");
	});
});
