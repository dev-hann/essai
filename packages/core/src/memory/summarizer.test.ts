import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	generateText: vi.fn(),
}));

vi.mock("ai", () => ({
	generateText: mocks.generateText,
}));

import type { ProjectConfig } from "../config/project-config.js";
import type { ProjectConfigData } from "../config/schema.js";
import { Summarizer } from "./summarizer.js";

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

function llmSummaryResponse(fields: Record<string, unknown>) {
	return { text: JSON.stringify(fields) };
}

describe("Summarizer", () => {
	beforeEach(() => {
		mocks.generateText.mockReset();
	});

	it("returns a ChapterMemory with the chapter, title, and wordCount provided", async () => {
		mocks.generateText.mockResolvedValue(
			llmSummaryResponse({
				events: ["사건"],
				emotions: [],
				foreshadowing: [],
				facts: [],
				characterState: {},
			}),
		);

		const summarizer = new Summarizer();
		const memory = await summarizer.summarize(
			3,
			"세 번째 만남",
			"챕터내용",
			newConfig(sampleConfigData()),
		);

		expect(memory.chapter).toBe(3);
		expect(memory.title).toBe("세 번째 만남");
		expect(memory.wordCount).toBe(4);
	});

	it("calls generateText with the model built from config", async () => {
		mocks.generateText.mockResolvedValue(
			llmSummaryResponse({
				events: [],
				emotions: [],
				foreshadowing: [],
				facts: [],
				characterState: {},
			}),
		);

		const summarizer = new Summarizer();
		await summarizer.summarize(1, "t", "c", newConfig(sampleConfigData()));

		expect(mocks.generateText).toHaveBeenCalledTimes(1);
		const call = mocks.generateText.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(call.model).toBeDefined();
	});

	it("passes temperature and maxTokens from config", async () => {
		mocks.generateText.mockResolvedValue(
			llmSummaryResponse({
				events: [],
				emotions: [],
				foreshadowing: [],
				facts: [],
				characterState: {},
			}),
		);

		const summarizer = new Summarizer();
		await summarizer.summarize(1, "t", "c", newConfig(sampleConfigData()));

		const call = mocks.generateText.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(call.temperature).toBe(0.7);
		expect(call.maxOutputTokens).toBe(8000);
	});

	it("includes chapter content and title in the prompt", async () => {
		mocks.generateText.mockResolvedValue(
			llmSummaryResponse({
				events: [],
				emotions: [],
				foreshadowing: [],
				facts: [],
				characterState: {},
			}),
		);

		const summarizer = new Summarizer();
		await summarizer.summarize(
			5,
			"다시 만남",
			"도윤이 지아에게 편지를 썼다.",
			newConfig(sampleConfigData()),
		);

		const call = mocks.generateText.mock.calls[0]?.[0] as { prompt: string };
		expect(call.prompt).toContain("다시 만남");
		expect(call.prompt).toContain("도윤이 지아에게 편지를 썼다.");
	});

	it("asks the model to respond in the configured language", async () => {
		mocks.generateText.mockResolvedValue(
			llmSummaryResponse({
				events: [],
				emotions: [],
				foreshadowing: [],
				facts: [],
				characterState: {},
			}),
		);

		const summarizer = new Summarizer();
		await summarizer.summarize(
			1,
			"t",
			"c",
			newConfig(sampleConfigData({ language: "ko" })),
		);

		const call = mocks.generateText.mock.calls[0]?.[0] as { system: string };
		expect(call.system).toContain("ko");
	});

	it("extracts events, emotions, foreshadowing, facts, characterState from the model output", async () => {
		mocks.generateText.mockResolvedValue(
			llmSummaryResponse({
				events: ["도윤이 카페에서 지아를 만남", "우산을 빌려줌"],
				emotions: [
					{ character: "도윤", emotion: "경계 → 호감", intensity: "medium" },
					{
						character: "지아",
						emotion: "긴장",
						intensity: "high",
						note: "낯선 사람 앞",
					},
				],
				foreshadowing: [
					{ item: "지아의 우산", status: "unresolved", chapterIntroduced: 1 },
				],
				facts: ["지아는 대만에서 왔다"],
				characterState: {
					도윤: { location: "카페", mood: "호기심", knows: ["지아의 이름"] },
				},
			}),
		);

		const summarizer = new Summarizer();
		const memory = await summarizer.summarize(
			1,
			"첫 만남",
			"챕터 본문",
			newConfig(sampleConfigData()),
		);

		expect(memory.events).toEqual([
			"도윤이 카페에서 지아를 만남",
			"우산을 빌려줌",
		]);
		expect(memory.emotions).toHaveLength(2);
		expect(memory.emotions[0]?.character).toBe("도윤");
		expect(memory.foreshadowing[0]?.item).toBe("지아의 우산");
		expect(memory.facts).toEqual(["지아는 대만에서 왔다"]);
		expect(memory.characterState.도윤?.location).toBe("카페");
	});

	it("strips a markdown code fence from the model response", async () => {
		const fields = {
			events: ["event"],
			emotions: [],
			foreshadowing: [],
			facts: [],
			characterState: {},
		};
		mocks.generateText.mockResolvedValue({
			text: `\`\`\`json\n${JSON.stringify(fields)}\n\`\`\``,
		});

		const summarizer = new Summarizer();
		const memory = await summarizer.summarize(
			1,
			"t",
			"c",
			newConfig(sampleConfigData()),
		);

		expect(memory.events).toEqual(["event"]);
	});

	it("returns a placeholder memory when the model output is not JSON", async () => {
		// Regression: previously this threw, which crashed the pipeline. The
		// Summarizer now degrades gracefully so a flaky model response does
		// not destroy the chapter just written.
		mocks.generateText.mockResolvedValue({ text: "not json at all" });

		const summarizer = new Summarizer();
		const memory = await summarizer.summarize(
			1,
			"t",
			"c",
			newConfig(sampleConfigData()),
		);

		expect(memory.events).toEqual([]);
		expect(memory.emotions).toEqual([]);
		expect(memory.foreshadowing).toEqual([]);
		expect(memory.characterState).toEqual({});
		expect(memory.facts.length).toBeGreaterThan(0);
		expect(memory.facts[0]).toMatch(/non-JSON/i);
	});

	it("throws when the model output has an invalid emotion intensity", async () => {
		mocks.generateText.mockResolvedValue(
			llmSummaryResponse({
				events: [],
				emotions: [{ character: "x", emotion: "y", intensity: "enormous" }],
				foreshadowing: [],
				facts: [],
				characterState: {},
			}),
		);

		const summarizer = new Summarizer();
		await expect(
			summarizer.summarize(1, "t", "c", newConfig(sampleConfigData())),
		).rejects.toThrow();
	});

	it("returns a placeholder memory when chapter content is empty", async () => {
		// Regression: BUG#9 — Summarizer previously crashed when an upstream
		// pipeline failure (empty ChapterWriter output) reached it.
		const summarizer = new Summarizer();
		const memory = await summarizer.summarize(
			1,
			"title",
			"",
			newConfig(sampleConfigData()),
		);

		expect(memory.events).toEqual([]);
		expect(memory.wordCount).toBe(0);
		expect(memory.facts.length).toBeGreaterThan(0);
	});
});
