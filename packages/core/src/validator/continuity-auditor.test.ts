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
import type { ChapterMemory } from "../memory/types.js";
import { ContinuityAuditor } from "./continuity-auditor.js";
import type { WorldData } from "./world-types.js";

function sampleConfigData(): ProjectConfigData {
	return {
		name: "test",
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
		characters: { 도윤: { speech: "짧고 건조함" } },
		relationships: [],
		emotion: [],
		chapters: new Map([[1, { number: 1, title: "x", scenes: [] }]]),
		style: ["구어체"],
		tone: ["잔잔하게"],
		constraints: [],
		additionalContext: {},
	};
}

function sampleMemory(): ChapterMemory {
	return {
		chapter: 1,
		title: "첫 만남",
		wordCount: 1000,
		events: ["지아를 만남"],
		emotions: [],
		foreshadowing: [],
		facts: ["지아는 서점 운영자"],
		characterState: {
			도윤: { location: "카페", mood: "호기심", knows: ["지아의 이름"] },
		},
		propsIntroduced: [],
		propsUsed: [],
		languageLevel: [],
	};
}

function emptyWorld(): WorldData {
	return { locations: [], props: [], timeline: [] };
}

describe("ContinuityAuditor", () => {
	beforeEach(() => {
		mocks.generateText.mockReset();
	});

	it("returns info finding when LLM verdict is 'ok'", async () => {
		mocks.generateText.mockResolvedValue({
			text: '{"severity":"ok","message":"캐릭터 일관성 유지됨"}',
		});
		const auditor = new ContinuityAuditor(newConfig(sampleConfigData()));
		const findings = await auditor.audit(
			1,
			"본문",
			sampleBible(),
			[sampleMemory()],
			emptyWorld(),
			{ only: ["character-consistency"] },
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.severity).toBe("info");
		expect(findings[0]?.rule).toBe("audit:character-consistency");
	});

	it("maps 'error' severity through", async () => {
		mocks.generateText.mockResolvedValue({
			text: '{"severity":"error","message":"도윤이 갑자기 시를 읊음 — 설정상 말투 아님"}',
		});
		const auditor = new ContinuityAuditor(newConfig(sampleConfigData()));
		const findings = await auditor.audit(
			1,
			"본문",
			sampleBible(),
			[],
			emptyWorld(),
			{ only: ["character-consistency"] },
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.severity).toBe("error");
		expect(findings[0]?.message).toContain("도윤");
	});

	it("limits dimensions to the 'only' list", async () => {
		mocks.generateText.mockResolvedValue({
			text: '{"severity":"ok","message":"x"}',
		});
		const auditor = new ContinuityAuditor(newConfig(sampleConfigData()));
		const findings = await auditor.audit(
			1,
			"본문",
			sampleBible(),
			[],
			emptyWorld(),
			{ only: ["pacing"] },
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.rule).toBe("audit:pacing");
		expect(mocks.generateText).toHaveBeenCalledTimes(1);
	});

	it("falls back to info finding when LLM returns non-JSON", async () => {
		mocks.generateText.mockResolvedValue({ text: "캐릭터가 일관됩니다." });
		const auditor = new ContinuityAuditor(newConfig(sampleConfigData()));
		const findings = await auditor.audit(
			1,
			"본문",
			sampleBible(),
			[],
			emptyWorld(),
			{ only: ["character-consistency"] },
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.severity).toBe("info");
		expect(findings[0]?.message).toMatch(/non-JSON/);
	});

	it("strips ```json fence wrapper before parsing", async () => {
		mocks.generateText.mockResolvedValue({
			text: '```json\n{"severity":"warning","message":"감정선 점프"}\n```',
		});
		const auditor = new ContinuityAuditor(newConfig(sampleConfigData()));
		const findings = await auditor.audit(
			1,
			"본문",
			sampleBible(),
			[],
			emptyWorld(),
			{ only: ["emotion-continuity"] },
		);
		expect(findings[0]?.severity).toBe("warning");
		expect(findings[0]?.message).toBe("감정선 점프");
	});

	it("returns info finding when LLM call rejects", async () => {
		mocks.generateText.mockRejectedValue(new Error("rate limited"));
		const auditor = new ContinuityAuditor(newConfig(sampleConfigData()));
		const findings = await auditor.audit(
			1,
			"본문",
			sampleBible(),
			[],
			emptyWorld(),
			{ only: ["timeline"] },
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.severity).toBe("info");
		expect(findings[0]?.message).toMatch(/rate limited/);
	});

	it("passes language baseline into context when supplied", async () => {
		mocks.generateText.mockImplementation(async (opts: { prompt: string }) => {
			return {
				text: JSON.stringify({
					severity: "ok",
					message: opts.prompt.includes("A2") ? "baseline seen" : "no baseline",
				}),
			};
		});
		const auditor = new ContinuityAuditor(newConfig(sampleConfigData()));
		const findings = await auditor.audit(
			1,
			"본문",
			sampleBible(),
			[],
			emptyWorld(),
			{
				only: ["language-progression"],
				languageBaseline: [
					{ character: "지아", level: "A2", note: "짧은 인사" },
				],
			},
		);
		expect(findings[0]?.message).toBe("baseline seen");
	});
});
