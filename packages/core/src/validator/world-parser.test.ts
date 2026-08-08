import { describe, expect, it } from "vitest";
import { parseWorld } from "./world-parser.js";

describe("parseWorld", () => {
	it("returns empty defaults when world.md is blank", () => {
		const w = parseWorld("");
		expect(w.locations).toEqual([]);
		expect(w.props).toEqual([]);
		expect(w.timeline).toEqual([]);
	});

	it("parses locations with explicit floor markers", () => {
		const w = parseWorld(`
## 공간
- 분식집: 1층 (101호)
- 도윤: 302호 (3층)
- 산링: 301호 (3층)
`);
		expect(w.locations).toHaveLength(3);
		const bunshik = w.locations.find((l) => l.name.includes("분식집"));
		expect(bunshik?.floor).toBe(1);
		expect(bunshik?.room).toBe(101);
		const doyun = w.locations.find((l) => l.name.includes("도윤"));
		expect(doyun?.floor).toBe(3);
		expect(doyun?.room).toBe(302);
	});

	it("derives floor from 3-digit room number when no explicit floor given", () => {
		const w = parseWorld(`
## 공간
- 도윤: 302호
`);
		expect(w.locations[0]?.floor).toBe(3);
		expect(w.locations[0]?.room).toBe(302);
	});

	it("parses forbidden vs allowed props via ❌/금지 markers", () => {
		const w = parseWorld(`
## 소품 규칙
- 출입: 도어락. 열쇠 ❌
- 통신: 카톡, 전화
`);
		const key = w.props.find((p) => p.name.includes("출입"));
		expect(key?.allowed).toBe(false);
		const comm = w.props.find((p) => p.name.includes("통신"));
		expect(comm?.allowed).toBe(true);
	});

	it("parses timeline entries with slash-separated anchors", () => {
		const w = parseWorld(`
## 타임라인
- 입국: 9월 / 귀국: 3월 / 총 6개월
`);
		expect(w.timeline).toHaveLength(1);
		const entry = w.timeline[0];
		if (!entry) throw new Error("timeline entry not parsed");
		expect(entry.start).toContain("9월");
		expect(entry.end).toContain("3월");
		expect(entry.durationMonths).toBe(6);
	});

	it("parses year-based durations into months", () => {
		const w = parseWorld(`
## 타임라인
- 거주: 1년
`);
		expect(w.timeline[0]?.durationMonths).toBe(12);
	});

	it("ignores lines that are not bullets under a known section", () => {
		const w = parseWorld(`
## 공간
This is a paragraph, not a bullet.
- 도윤: 302호
`);
		expect(w.locations).toHaveLength(1);
	});

	it("ignores bullets outside any known section", () => {
		const w = parseWorld(`
- orphan bullet
## 공간
- 분식집: 1층
`);
		expect(w.locations).toHaveLength(1);
	});
});
