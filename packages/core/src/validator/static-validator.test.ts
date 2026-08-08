import { describe, expect, it } from "vitest";
import { StaticValidator } from "./static-validator.js";
import type { WorldData } from "./world-types.js";

function world(partial: Partial<WorldData>): WorldData {
	return {
		locations: partial.locations ?? [],
		props: partial.props ?? [],
		timeline: partial.timeline ?? [],
	};
}

describe("StaticValidator", () => {
	it("returns no findings when world data is empty", () => {
		const v = new StaticValidator();
		const findings = v.validate("아무 내용이나 쓴다", world({}));
		expect(findings).toEqual([]);
	});

	it("returns no findings when content is empty", () => {
		const v = new StaticValidator();
		const findings = v.validate("", world({}));
		expect(findings).toEqual([]);
	});

	describe("floor-consistency", () => {
		it("flags adjacency claim between characters on different floors", () => {
			const v = new StaticValidator();
			const w = world({
				locations: [
					{ name: "도윤", floor: 3, room: 302, raw: "도윤 302호 3층" },
					{ name: "산링", floor: 2, room: 203, raw: "산링 203호 2층" },
				],
			});
			// Regression: BUG from my-first-novel — they were called "벽 하나
			// 사이" but lived on different floors.
			const content = "도윤은 벽 하나 사이인 산링의 방을 두드렸다.";
			const findings = v.validate(content, w);
			expect(findings.some((f) => f.rule === "floor-consistency")).toBe(true);
		});

		it("passes when adjacent characters share the same floor", () => {
			const v = new StaticValidator();
			const w = world({
				locations: [
					{ name: "도윤", floor: 3, room: 302, raw: "도윤 302호" },
					{ name: "산링", floor: 3, room: 301, raw: "산링 301호" },
				],
			});
			const content = "도윤은 벽 하나 사이인 산링의 방을 두드렸다.";
			const findings = v.validate(content, w);
			expect(findings).toEqual([]);
		});

		it("skips when no adjacency phrase appears", () => {
			const v = new StaticValidator();
			const w = world({
				locations: [
					{ name: "도윤", floor: 3, room: 302, raw: "" },
					{ name: "산링", floor: 2, room: 203, raw: "" },
				],
			});
			const content = "도윤은 산링을 떠올렸다.";
			const findings = v.validate(content, w);
			expect(findings).toEqual([]);
		});

		it("can be disabled via opts.disable", () => {
			const v = new StaticValidator({ disable: ["floor-consistency"] });
			const w = world({
				locations: [
					{ name: "도윤", floor: 3, room: 302, raw: "" },
					{ name: "산링", floor: 2, room: 203, raw: "" },
				],
			});
			const content = "도윤은 벽 하나 사이인 산링의 방을 두드렸다.";
			expect(v.validate(content, w)).toEqual([]);
		});
	});

	describe("forbidden-props", () => {
		it("flags a forbidden prop that appears in the text", () => {
			const v = new StaticValidator();
			const w = world({
				props: [{ name: "열쇠", allowed: false, raw: "열쇠 ❌" }],
			});
			const findings = v.validate("도윤은 열쇠를 꺼냈다.", w);
			expect(findings.some((f) => f.rule === "forbidden-props")).toBe(true);
		});

		it("does not flag allowed props", () => {
			const v = new StaticValidator();
			const w = world({
				props: [{ name: "카톡", allowed: true, raw: "카톡" }],
			});
			const findings = v.validate("지아가 카톡을 보냈다.", w);
			expect(findings).toEqual([]);
		});

		it("flags mixed 도어락/열쇠 contradiction even without world entry", () => {
			const v = new StaticValidator();
			const findings = v.validate(
				"그는 도어락 비밀번호를 누르고 열쇠로 잠갔다.",
				world({}),
			);
			expect(findings.some((f) => f.severity === "warning")).toBe(true);
		});
	});

	describe("visa-duration", () => {
		it("flags H-1 visa with duration wildly off the typical 6 months", () => {
			const v = new StaticValidator();
			const content = "그녀의 H-1 비자는 1년이었다.";
			const findings = v.validate(content, world({}));
			expect(findings.some((f) => f.rule === "visa-duration")).toBe(true);
		});

		it("passes when duration matches the typical visa window", () => {
			const v = new StaticValidator();
			const content = "그녀의 H-1 비자는 6개월이었다.";
			const findings = v.validate(content, world({}));
			expect(findings).toEqual([]);
		});

		it("stays quiet when no visa mentioned", () => {
			const v = new StaticValidator();
			const content = "그녀는 6개월간 머물렀다.";
			const findings = v.validate(content, world({}));
			expect(findings).toEqual([]);
		});
	});
});
