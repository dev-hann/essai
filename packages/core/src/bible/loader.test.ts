import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadBible } from "./loader.js";

async function tmpBibleDir(): Promise<string> {
	return await fs.mkdtemp(path.join(os.tmpdir(), "essai-bible-"));
}

async function writeBibleFile(dir: string, name: string, content: string) {
	await fs.writeFile(path.join(dir, name), content, "utf-8");
}

describe("loadBible", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await tmpBibleDir();
	});

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("parses every known bible file into the matching field", async () => {
		await writeBibleFile(
			dir,
			"characters.md",
			["## 도윤", "- 나이: 25"].join("\n"),
		);
		await writeBibleFile(dir, "relationships.md", "- 도윤 → 지아: 호감");
		await writeBibleFile(
			dir,
			"emotion.md",
			["## 1단계 — 경계 (1~3화)", "- 도윤: 긴장"].join("\n"),
		);
		await writeBibleFile(
			dir,
			"chapters.md",
			["## 1화: 첫 만남", "- 카페에서 만남"].join("\n"),
		);
		await writeBibleFile(dir, "style.md", "- Colloquial dialogue");
		await writeBibleFile(dir, "tone.md", "- Gentle");
		await writeBibleFile(dir, "constraints.md", "- No new characters");

		const bible = await loadBible(dir);

		expect(bible.characters).toEqual({ 도윤: { 나이: "25" } });
		expect(bible.relationships).toEqual([
			{ from: "도윤", to: "지아", description: "호감" },
		]);
		expect(bible.emotion).toEqual([
			{
				stage: 1,
				name: "경계",
				chapters: "1~3화",
				emotions: { 도윤: "긴장" },
			},
		]);
		expect(bible.chapters.get(1)).toEqual({
			number: 1,
			title: "첫 만남",
			scenes: ["카페에서 만남"],
		});
		expect(bible.style).toEqual(["Colloquial dialogue"]);
		expect(bible.tone).toEqual(["Gentle"]);
		expect(bible.constraints).toEqual(["No new characters"]);
		expect(bible.additionalContext).toEqual({});
	});

	it("collects unknown .md files into additionalContext keyed by file stem", async () => {
		await writeBibleFile(dir, "world.md", "# The Continent of Essai");
		await writeBibleFile(dir, "magic.md", "- Fire costs stamina");

		const bible = await loadBible(dir);

		expect(bible.additionalContext.world).toBe("# The Continent of Essai");
		expect(bible.additionalContext.magic).toBe("- Fire costs stamina");
	});

	it("returns an empty BibleData when the directory does not exist", async () => {
		const missing = path.join(dir, "does-not-exist");
		const bible = await loadBible(missing);

		expect(bible.characters).toEqual({});
		expect(bible.relationships).toEqual([]);
		expect(bible.emotion).toEqual([]);
		expect(bible.chapters.size).toBe(0);
		expect(bible.style).toEqual([]);
		expect(bible.tone).toEqual([]);
		expect(bible.constraints).toEqual([]);
		expect(bible.additionalContext).toEqual({});
	});

	it("returns an empty BibleData for an empty directory", async () => {
		const bible = await loadBible(dir);

		expect(bible.characters).toEqual({});
		expect(bible.chapters.size).toBe(0);
		expect(bible.additionalContext).toEqual({});
	});

	it("ignores non-markdown files", async () => {
		await writeBibleFile(dir, "notes.txt", "ignore me");
		await writeBibleFile(dir, "style.md", "- real rule");

		const bible = await loadBible(dir);

		expect(bible.style).toEqual(["real rule"]);
		expect(Object.keys(bible.additionalContext)).toEqual([]);
	});
});
