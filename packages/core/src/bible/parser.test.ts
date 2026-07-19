import { describe, expect, it } from "vitest";
import {
	findEmotionStage,
	parseChapterRange,
	parseCharacters,
	parseChapters,
	parseEmotion,
	parseList,
	parseRelationships,
} from "./parser.js";
import type { EmotionStage } from "./types.js";

describe("parseCharacters", () => {
	it("parses ## name sections with - key: value fields", () => {
		const md = [
			"## 도윤",
			"- 나이: 25",
			"- 직업: 전기공학 4학년",
			"- 성격: 차분하다",
			"",
			"## 지아",
			"- 나이: 23",
			"- 직업: 워홀러",
		].join("\n");

		expect(parseCharacters(md)).toEqual({
			도윤: { 나이: "25", 직업: "전기공학 4학년", 성격: "차분하다" },
			지아: { 나이: "23", 직업: "워홀러" },
		});
	});

	it("splits on the first colon so values may contain colons", () => {
		const md = ["## 도윤", "- 시간: 12:30"].join("\n");

		expect(parseCharacters(md)).toEqual({
			도윤: { 시간: "12:30" },
		});
	});

	it("returns an empty object for empty input", () => {
		expect(parseCharacters("")).toEqual({});
		expect(parseCharacters("   \n  ")).toEqual({});
	});

	it("creates an empty field map for a header with no fields", () => {
		const md = "## 도윤\n";
		expect(parseCharacters(md)).toEqual({ 도윤: {} });
	});
});

describe("parseRelationships", () => {
	it("parses A → B: description lines", () => {
		const md = [
			"- 도윤 → 지아: 첫 만남에서 호감",
			"- 지아 → 도윤: 점차 마음을 엶",
		].join("\n");

		expect(parseRelationships(md)).toEqual([
			{ from: "도윤", to: "지아", description: "첫 만남에서 호감" },
			{ from: "지아", to: "도윤", description: "점차 마음을 엶" },
		]);
	});

	it("accepts ASCII -> as an alias for →", () => {
		const md = "- 도윤 -> 지아: friend";
		expect(parseRelationships(md)).toEqual([
			{ from: "도윤", to: "지아", description: "friend" },
		]);
	});

	it("returns an empty array for empty input", () => {
		expect(parseRelationships("")).toEqual([]);
	});

	it("ignores lines that are not relationship bullets", () => {
		const md = ["# Relationships", "- just a note", "- a: b"].join("\n");
		expect(parseRelationships(md)).toEqual([]);
	});
});

describe("parseEmotion", () => {
	it("parses N단계 — name (range) headers with character emotions", () => {
		const md = [
			"## 1단계 — 경계 (1~3화)",
			"- 도윤: 호기심",
			"- 지아: 경계",
			"",
			"## 2단계 — 접근 (4~6화)",
			"- 도윤: 호감",
			"- 지아: 마음을 엶",
		].join("\n");

		expect(parseEmotion(md)).toEqual([
			{
				stage: 1,
				name: "경계",
				chapters: "1~3화",
				emotions: { 도윤: "호기심", 지아: "경계" },
			},
			{
				stage: 2,
				name: "접근",
				chapters: "4~6화",
				emotions: { 도윤: "호감", 지아: "마음을 엶" },
			},
		]);
	});

	it("accepts a hyphen as a synonym for the em dash", () => {
		const md = ["## 1단계 - 경계 (1~3화)", "- 도윤: 긴장"].join("\n");
		expect(parseEmotion(md)).toEqual([
			{
				stage: 1,
				name: "경계",
				chapters: "1~3화",
				emotions: { 도윤: "긴장" },
			},
		]);
	});

	it("returns an empty array for empty input", () => {
		expect(parseEmotion("")).toEqual([]);
	});
});

describe("parseChapters", () => {
	it("parses ## N화: title headers with bullet scenes", () => {
		const md = [
			"## 1화: 첫 만남",
			"- 도윤이 카페에서 지아를 처음 본다",
			"- 지아가 길을 묻는다",
			"",
			"## 2화: 다시 만남",
			"- 우연히 버스에서 재회",
		].join("\n");

		const map = parseChapters(md);

		expect(map.size).toBe(2);
		expect(map.get(1)).toEqual({
			number: 1,
			title: "첫 만남",
			scenes: ["도윤이 카페에서 지아를 처음 본다", "지아가 길을 묻는다"],
		});
		expect(map.get(2)).toEqual({
			number: 2,
			title: "다시 만남",
			scenes: ["우연히 버스에서 재회"],
		});
	});

	it("returns an empty map for empty input", () => {
		expect(parseChapters("").size).toBe(0);
	});

	it("handles a chapter with no scenes", () => {
		const md = "## 5화: 결말\n";
		const map = parseChapters(md);
		expect(map.get(5)).toEqual({ number: 5, title: "결말", scenes: [] });
	});
});

describe("parseList", () => {
	it("collects bullet items as strings", () => {
		const md = ["- Use colloquial Korean", "- Short sentences"].join("\n");
		expect(parseList(md)).toEqual(["Use colloquial Korean", "Short sentences"]);
	});

	it("returns an empty array for empty input", () => {
		expect(parseList("")).toEqual([]);
	});

	it("ignores blank and non-bullet lines", () => {
		const md = ["# Style", "", "some prose", "- real rule"].join("\n");
		expect(parseList(md)).toEqual(["real rule"]);
	});
});

describe("parseChapterRange", () => {
	it("parses a tilde range with the 화 suffix", () => {
		expect(parseChapterRange("1~3화")).toEqual({ start: 1, end: 3 });
	});

	it("parses a hyphen range with the 화 suffix", () => {
		expect(parseChapterRange("1-3화")).toEqual({ start: 1, end: 3 });
	});

	it("parses an en-dash range", () => {
		expect(parseChapterRange("4–6화")).toEqual({ start: 4, end: 6 });
	});

	it("parses a bare range without the 화 suffix", () => {
		expect(parseChapterRange("1~3")).toEqual({ start: 1, end: 3 });
	});

	it("parses a single chapter as a one-chapter range", () => {
		expect(parseChapterRange("5화")).toEqual({ start: 5, end: 5 });
	});

	it("parses a bare single number as a one-chapter range", () => {
		expect(parseChapterRange("7")).toEqual({ start: 7, end: 7 });
	});

	it("returns null when the string has no numbers", () => {
		expect(parseChapterRange("overlap")).toBeNull();
	});

	it("returns null for empty input", () => {
		expect(parseChapterRange("")).toBeNull();
	});
});

describe("findEmotionStage", () => {
	const stages: EmotionStage[] = [
		{
			stage: 1,
			name: "경계",
			chapters: "1~3화",
			emotions: {},
		},
		{
			stage: 2,
			name: "접근",
			chapters: "4~6화",
			emotions: {},
		},
		{
			stage: 3,
			name: "결실",
			chapters: "7화",
			emotions: {},
		},
	];

	it("returns the stage whose range contains the chapter", () => {
		expect(findEmotionStage(stages, 2)?.name).toBe("경계");
		expect(findEmotionStage(stages, 5)?.name).toBe("접근");
		expect(findEmotionStage(stages, 7)?.name).toBe("결실");
	});

	it("returns null when no stage covers the chapter", () => {
		expect(findEmotionStage(stages, 99)).toBeNull();
	});

	it("returns null when there are no stages", () => {
		expect(findEmotionStage([], 1)).toBeNull();
	});

	it("skips stages whose range string cannot be parsed", () => {
		const messy: EmotionStage[] = [
			{ stage: 1, name: "x", chapters: "overlap", emotions: {} },
			{ stage: 2, name: "y", chapters: "1~3화", emotions: {} },
		];
		expect(findEmotionStage(messy, 2)?.name).toBe("y");
	});
});
