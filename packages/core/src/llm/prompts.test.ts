import { describe, expect, it } from "vitest";
import type { BibleData } from "../bible/types.js";
import type { MemoryEntry } from "../memory/types.js";
import { buildWriterPrompt } from "./prompts.js";

function sampleBible(): BibleData {
	return {
		characters: {
			도윤: { 나이: "25", 직업: "전기공학 4학년" },
			지아: { 나이: "23", 직업: "워홀러" },
		},
		relationships: [
			{ from: "도윤", to: "지아", description: "첫 만남에서 호감" },
		],
		emotion: [
			{
				stage: 1,
				name: "경계",
				chapters: "1~3화",
				emotions: { 도윤: "호기심", 지아: "긴장" },
			},
		],
		chapters: new Map([
			[
				1,
				{
					number: 1,
					title: "첫 만남",
					scenes: ["카페에서 첫 대면", "우산을 빌려줌"],
				},
			],
		]),
		style: ["Use colloquial dialogue."],
		tone: ["Gentle and quiet."],
		constraints: ["No new characters."],
		additionalContext: {
			world: "# The Continent\nA vast land.",
		},
	};
}

function sampleMemory(): MemoryEntry {
	return {
		chapter: 1,
		title: "첫 만남",
		wordCount: 3000,
		events: ["도윤이 지아에게 우산을 빌려줌"],
		emotions: [{ character: "도윤", emotion: "호감", intensity: "medium" }],
		foreshadowing: [
			{ item: "지아의 우산", status: "unresolved", chapterIntroduced: 1 },
		],
		facts: ["지아는 대만에서 왔다"],
		characterState: {
			도윤: { location: "카페", mood: "호기심", knows: ["지아의 이름"] },
		},
	};
}

describe("buildWriterPrompt", () => {
	it("returns an object with system and user strings", () => {
		const result = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 1,
			language: "ko",
			chapterWords: 3000,
		});

		expect(typeof result.system).toBe("string");
		expect(typeof result.user).toBe("string");
		expect(result.system.length).toBeGreaterThan(0);
		expect(result.user.length).toBeGreaterThan(0);
	});

	it("embeds the language directive in the system prompt", () => {
		const { system } = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 1,
			language: "ko",
			chapterWords: 3000,
		});

		expect(system).toContain("Write all prose, dialogue, and narration in ko.");
	});

	it("pulls style, tone, and constraints from the bible into the system prompt", () => {
		const { system } = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 1,
			language: "en",
			chapterWords: 3000,
		});

		expect(system).toContain("Use colloquial dialogue.");
		expect(system).toContain("Gentle and quiet.");
		expect(system).toContain("No new characters.");
	});

	it("includes the chapter plan title and scenes in the user prompt", () => {
		const { user } = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 1,
			language: "ko",
			chapterWords: 3000,
		});

		expect(user).toContain("첫 만남");
		expect(user).toContain("카페에서 첫 대면");
		expect(user).toContain("우산을 빌려줌");
	});

	it("includes bible context (characters, relationships, additional context)", () => {
		const { user } = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 1,
			language: "ko",
			chapterWords: 3000,
		});

		expect(user).toContain("도윤");
		expect(user).toContain("전기공학 4학년");
		expect(user).toContain("첫 만남에서 호감");
		expect(user).toContain("The Continent");
	});

	it("includes the word-count and language instruction", () => {
		const { user } = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 1,
			language: "ko",
			chapterWords: 3500,
		});

		expect(user).toContain("3500");
		expect(user).toContain("ko");
	});

	it("includes a custom instruction when provided", () => {
		const { user } = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 1,
			language: "ko",
			chapterWords: 3000,
			instruction: "대화를 더 늘려",
		});

		expect(user).toContain("대화를 더 늘려");
	});

	it("includes memory summaries when memory is provided", () => {
		const { user } = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 2,
			language: "ko",
			chapterWords: 3000,
			memory: [sampleMemory()],
		});

		expect(user).toContain("도윤이 지아에게 우산을 빌려줌");
		expect(user).toContain("지아의 우산");
	});

	it("omits the memory section when no memory is provided", () => {
		const { user } = buildWriterPrompt({
			bible: sampleBible(),
			chapterNumber: 1,
			language: "ko",
			chapterWords: 3000,
		});

		expect(user).not.toContain("undefined");
	});
});
