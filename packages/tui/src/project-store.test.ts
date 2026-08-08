import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type ChapterSummary,
	listBibleSections,
	listChapters,
	listProjects,
	readChapter,
} from "./project-store.js";

async function seedProject(
	root: string,
	files: Record<string, string>,
): Promise<void> {
	for (const [relative, content] of Object.entries(files)) {
		const fullPath = path.join(root, relative);
		await fs.mkdir(path.dirname(fullPath), { recursive: true });
		await fs.writeFile(fullPath, content, "utf-8");
	}
}

describe("project-store", () => {
	let tmp: string;
	let realHome: string | undefined;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-tui-store-"));
		// Force the global config path to a clean temp HOME so we don't
		// accidentally pick up the developer's real ~/.essai/config.json.
		realHome = process.env.HOME;
		process.env.HOME = tmp;
	});

	afterEach(async () => {
		if (realHome !== undefined) process.env.HOME = realHome;
		await fs.rm(tmp, { recursive: true, force: true });
	});

	describe("listProjects", () => {
		it("returns empty array when no global config exists", async () => {
			expect(await listProjects()).toEqual([]);
		});

		it("returns projects registered in global config", async () => {
			const configDir = path.join(tmp, ".essai");
			await fs.mkdir(configDir, { recursive: true });
			await fs.writeFile(
				path.join(configDir, "config.json"),
				JSON.stringify({
					defaultLanguage: "ko",
					defaultModel: "",
					defaultBaseUrl: "",
					defaultApiKey: "",
					defaultChapterWords: 3000,
					defaultTemperature: 0.7,
					projects: [
						{ name: "alpha", path: "/tmp/alpha", id: "alpha-1" },
						{ name: "beta", path: "/tmp/beta", id: "beta-2" },
					],
				}),
				"utf-8",
			);

			const projects = await listProjects();
			expect(projects.map((p) => p.name)).toEqual(["alpha", "beta"]);
		});
	});

	describe("listChapters", () => {
		it("returns empty array when chapters dir does not exist", async () => {
			expect(await listChapters(tmp)).toEqual([]);
		});

		it("lists chapters sorted by number with byte counts", async () => {
			await seedProject(tmp, {
				"chapters/002.md": "bb",
				"chapters/001.md": "aaaa",
				"chapters/010.md": "c",
				// Non-numeric files are ignored
				"chapters/notes.md": "ignore me",
				// .bak files are ignored
				"chapters/001.md.bak": "backup",
			});

			const chapters = await listChapters(tmp);
			expect(chapters.map((c) => c.number)).toEqual([1, 2, 10]);
			const one = chapters.find((c) => c.number === 1) as ChapterSummary;
			expect(one.fileName).toBe("001.md");
			expect(one.wordCount).toBe(4);
		});
	});

	describe("readChapter", () => {
		it("throws ENOENT when chapter missing", async () => {
			await expect(readChapter(tmp, 99)).rejects.toThrow();
		});

		it("returns raw chapter content with zero padding", async () => {
			await seedProject(tmp, { "chapters/007.md": "본문" });
			expect(await readChapter(tmp, 7)).toBe("본문");
		});
	});

	describe("listBibleSections", () => {
		it("returns empty array when bible dir missing", async () => {
			expect(await listBibleSections(tmp)).toEqual([]);
		});

		it("lists only .md files, sorted alphabetically", async () => {
			await seedProject(tmp, {
				"bible/characters.md": "## chars",
				"bible/style.md": "## style",
				"bible/notes.txt": "ignored",
			});

			const sections = await listBibleSections(tmp);
			expect(sections.map((s) => s.name)).toEqual([
				"characters.md",
				"style.md",
			]);
		});
	});
});
