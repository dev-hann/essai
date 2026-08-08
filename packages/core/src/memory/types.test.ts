import { describe, expect, it } from "vitest";
import { chapterMemorySchema } from "./types.js";

function validMemory() {
	return {
		chapter: 1,
		title: "첫 만남",
		wordCount: 3021,
		events: ["도윤이 카페에서 지아를 만났다"],
		emotions: [
			{ character: "도윤", emotion: "경계 → 호감", intensity: "medium" },
			{
				character: "지아",
				emotion: "긴장",
				intensity: "high",
				note: "낯선 사람 앞에서",
			},
		],
		foreshadowing: [
			{ item: "지아의 우산", status: "unresolved", chapterIntroduced: 1 },
		],
		facts: ["지아는 대만에서 왔다"],
		characterState: {
			도윤: { location: "카페", mood: "호기심", knows: ["지아의 이름"] },
		},
	};
}

describe("chapterMemorySchema", () => {
	it("parses a fully-specified chapter memory", () => {
		expect(chapterMemorySchema.parse(validMemory())).toEqual(validMemory());
	});

	it("parses a memory with empty arrays", () => {
		const minimal = {
			chapter: 2,
			title: "빈 화",
			wordCount: 0,
			events: [],
			emotions: [],
			foreshadowing: [],
			facts: [],
			characterState: {},
		};

		expect(chapterMemorySchema.parse(minimal)).toEqual(minimal);
	});

	it("rejects an invalid emotion intensity", () => {
		const bad = {
			...validMemory(),
			emotions: [{ character: "도윤", emotion: "x", intensity: "enormous" }],
		};

		expect(() => chapterMemorySchema.parse(bad)).toThrow();
	});

	it("rejects an invalid foreshadowing status", () => {
		const bad = {
			...validMemory(),
			foreshadowing: [{ item: "x", status: "maybe", chapterIntroduced: 1 }],
		};

		expect(() => chapterMemorySchema.parse(bad)).toThrow();
	});

	it("rejects a memory missing the chapter number", () => {
		const { chapter: _chapter, ...bad } = validMemory();
		void _chapter;
		expect(() => chapterMemorySchema.parse(bad)).toThrow();
	});

	it("rejects a memory missing the title", () => {
		const { title: _title, ...bad } = validMemory();
		void _title;
		expect(() => chapterMemorySchema.parse(bad)).toThrow();
	});
});
