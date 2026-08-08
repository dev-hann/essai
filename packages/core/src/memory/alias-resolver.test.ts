import { describe, expect, it } from "vitest";
import {
	parseAliasesFromCharactersMd,
	resolveCharacterAliases,
} from "./alias-resolver.js";
import type { ChapterMemory } from "./types.js";

function memory(overrides: Partial<ChapterMemory> = {}): ChapterMemory {
	return {
		chapter: 1,
		title: "x",
		wordCount: 0,
		events: [],
		emotions: [],
		foreshadowing: [],
		facts: [],
		characterState: {},
		propsIntroduced: [],
		propsUsed: [],
		languageLevel: [],
		...overrides,
	};
}

describe("parseAliasesFromCharactersMd", () => {
	it("parses aliases from - aliases: field under each ## heading", () => {
		const raw = `
## 지아
- age: 26
- aliases: 카운터 여자, 서점 주인

## 도윤
- age: 28
`;
		expect(parseAliasesFromCharactersMd(raw)).toEqual({
			지아: ["카운터 여자", "서점 주인"],
		});
	});

	it("returns empty map when no aliases are declared", () => {
		const raw = `
## 지아
- age: 26
`;
		expect(parseAliasesFromCharactersMd(raw)).toEqual({});
	});

	it("tolerates Korean full-width colon and trailing commas", () => {
		const raw = `
## 지아
- aliases： 카운터 여자, 서점 주인,
`;
		expect(parseAliasesFromCharactersMd(raw)).toEqual({
			지아: ["카운터 여자", "서점 주인"],
		});
	});

	it("ignores blank alias values", () => {
		const raw = `
## x
- aliases: , ,
`;
		expect(parseAliasesFromCharactersMd(raw)).toEqual({});
	});
});

describe("resolveCharacterAliases", () => {
	it("rewrites alias names in emotions, characterState, languageLevel", () => {
		const aliases = { 지아: ["카운터 여자"] };
		const mems = [
			memory({
				chapter: 1,
				emotions: [
					{ character: "카운터 여자", emotion: "경계", intensity: "medium" },
				],
				characterState: {
					"카운터 여자": {
						location: "카페",
						mood: "낯가림",
						knows: ["도윤의 이름"],
					},
				},
				languageLevel: [{ character: "카운터 여자", level: "A2" }],
			}),
			memory({
				chapter: 2,
				emotions: [{ character: "지아", emotion: "호감", intensity: "medium" }],
				characterState: { 지아: { location: "서점", mood: "안도", knows: [] } },
			}),
		];

		const out = resolveCharacterAliases(mems, aliases);

		// All references now use the canonical name.
		expect(out[0]?.emotions[0]?.character).toBe("지아");
		expect(Object.keys(out[0]?.characterState ?? {})).toEqual(["지아"]);
		expect(out[0]?.languageLevel[0]?.character).toBe("지아");
		// Chapter 2 was already canonical — unchanged.
		expect(out[1]?.emotions[0]?.character).toBe("지아");
	});

	it("is a no-op when alias map is empty", () => {
		const mems = [
			memory({
				emotions: [{ character: "x", emotion: "y", intensity: "low" }],
			}),
		];
		const out = resolveCharacterAliases(mems, {});
		expect(out).toEqual(mems);
	});

	it("does not mutate the input array", () => {
		const aliases = { 지아: ["카운터 여자"] };
		const original = memory({
			emotions: [{ character: "카운터 여자", emotion: "x", intensity: "low" }],
		});
		const mems = [original];
		resolveCharacterAliases(mems, aliases);
		expect(original.emotions[0]?.character).toBe("카운터 여자");
	});

	it("leaves unknown names alone", () => {
		const aliases = { 지아: ["카운터 여자"] };
		const mems = [
			memory({
				emotions: [{ character: "정호", emotion: "걱정", intensity: "low" }],
			}),
		];
		const out = resolveCharacterAliases(mems, aliases);
		expect(out[0]?.emotions[0]?.character).toBe("정호");
	});
});
