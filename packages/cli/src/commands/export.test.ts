import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildExportContent,
	type ExportFormat,
	exportCommand,
} from "./export.js";

async function writeChapter(
	dir: string,
	n: number,
	content: string,
): Promise<void> {
	const chaptersDir = path.join(dir, "chapters");
	await fs.mkdir(chaptersDir, { recursive: true });
	const name = n.toString().padStart(3, "0");
	await fs.writeFile(path.join(chaptersDir, `${name}.md`), content, "utf-8");
}

describe("buildExportContent", () => {
	it("concatenates chapters in ascending order with a separator for md format", () => {
		const files = [
			{ name: "001.md", content: "first body" },
			{ name: "002.md", content: "second body" },
		];
		const out = buildExportContent(files, "md");
		expect(out).toContain("first body");
		expect(out).toContain("second body");
		expect(out).toContain("Chapter 1");
		expect(out).toContain("Chapter 2");
	});

	it("joins chapters as plain text without headers for txt format", () => {
		const files = [{ name: "001.md", content: "just text" }];
		const out = buildExportContent(files, "txt");
		expect(out).toContain("just text");
		expect(out).not.toMatch(/^#+\s*Chapter/m);
	});

	it("inserts a blank line between chapters", () => {
		const files = [
			{ name: "001.md", content: "AAA" },
			{ name: "002.md", content: "BBB" },
		];
		const out = buildExportContent(files, "txt");
		expect(out).toMatch(/AAA\s+BBB/);
	});

	it("returns an empty string when no chapters exist", () => {
		expect(buildExportContent([], "md")).toBe("");
		expect(buildExportContent([], "txt")).toBe("");
	});

	it("keeps chapter ordering stable regardless of input order", () => {
		const files = [
			{ name: "002.md", content: "two" },
			{ name: "001.md", content: "one" },
		];
		const out = buildExportContent(files, "txt");
		expect(out.indexOf("one")).toBeLessThan(out.indexOf("two"));
	});

	it("strips ATX heading markers from chapter content in txt format", () => {
		// Regression: BUG#10 — txt export used to embed raw markdown
		// ("# 1화: 같은 자리"). The plain text format must drop heading
		// syntax while keeping the heading prose.
		const out = buildExportContent(
			[{ name: "001.md", content: "# 1화: 같은 자리\n\n본문 내용" }],
			"txt",
		);
		expect(out).not.toContain("#");
		expect(out).toContain("1화: 같은 자리");
		expect(out).toContain("본문 내용");
	});

	it("strips emphasis, code spans, and horizontal rules in txt format", () => {
		const out = buildExportContent(
			[
				{
					name: "001.md",
					content:
						"**bold** and *italic* and `code` and --- separator",
				},
			],
			"txt",
		);
		expect(out).toContain("bold");
		expect(out).toContain("italic");
		expect(out).toContain("code");
		expect(out).not.toContain("**");
		expect(out).not.toContain("*");
		expect(out).not.toContain("`");
		expect(out).not.toMatch(/^---\s*$/m);
	});

	it("preserves markdown syntax in md format", () => {
		const out = buildExportContent(
			[
				{
					name: "001.md",
					content: "# 제목\n\n**강조** 본문",
				},
			],
			"md",
		);
		expect(out).toContain("# 제목");
		expect(out).toContain("**강조**");
	});
});

describe("exportCommand", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-export-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("writes exports/full.md by default with markdown format", async () => {
		await writeChapter(tmp, 1, "first");
		await writeChapter(tmp, 2, "second");

		await exportCommand({ cwd: tmp });

		const out = await fs.readFile(
			path.join(tmp, "exports", "full.md"),
			"utf-8",
		);
		expect(out).toContain("first");
		expect(out).toContain("second");
		expect(out).toContain("Chapter 1");
	});

	it("writes exports/full.txt when format is txt", async () => {
		await writeChapter(tmp, 1, "first");

		await exportCommand({ cwd: tmp, format: "txt" });

		const out = await fs.readFile(
			path.join(tmp, "exports", "full.txt"),
			"utf-8",
		);
		expect(out).toContain("first");
		expect(out).not.toContain("Chapter 1");
	});

	it("creates the exports directory if missing", async () => {
		await writeChapter(tmp, 1, "x");

		await exportCommand({ cwd: tmp });

		const stat = await fs.stat(path.join(tmp, "exports"));
		expect(stat.isDirectory()).toBe(true);
	});

	it("prints a confirmation line with the output path and chapter count", async () => {
		await writeChapter(tmp, 1, "a");
		await writeChapter(tmp, 2, "b");

		const lines: string[] = [];
		await exportCommand({
			cwd: tmp,
			stdout: { write: (c: string) => lines.push(c) },
		});

		const joined = lines.join("");
		expect(joined).toMatch(/exports[/]full\.md/);
		expect(joined).toContain("2");
	});

	it("throws when there are no chapters to export", async () => {
		await expect(exportCommand({ cwd: tmp })).rejects.toThrow();
	});

	it("respects the format option type", async () => {
		await writeChapter(tmp, 1, "x");
		const formats: ExportFormat[] = ["md", "txt"];
		for (const format of formats) {
			await exportCommand({ cwd: tmp, format });
		}
		expect(
			await fs.readFile(path.join(tmp, "exports", "full.md"), "utf-8"),
		).toContain("Chapter 1");
		expect(
			await fs.readFile(path.join(tmp, "exports", "full.txt"), "utf-8"),
		).toContain("x");
	});
});
