import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listChapters } from "./list.js";
import { readChapter } from "./read.js";
import { showStatus } from "./status.js";

interface Captured {
	lines: string[];
	write(chunk: string): void;
}

function newCapture(): Captured {
	const lines: string[] = [];
	return {
		lines,
		write(chunk: string) {
			lines.push(chunk);
		},
	};
}

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

async function writeBible(
	dir: string,
	chapters: Array<{ n: number; title: string }>,
): Promise<void> {
	const bibleDir = path.join(dir, "bible");
	await fs.mkdir(bibleDir, { recursive: true });
	const lines: string[] = [];
	for (const c of chapters) lines.push(`## ${c.n}화: ${c.title}`, "- scene");
	await fs.writeFile(
		path.join(bibleDir, "chapters.md"),
		lines.join("\n"),
		"utf-8",
	);
}

describe("readChapter", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-read-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("prints the content of chapters/NNN.md", async () => {
		await writeChapter(tmp, 1, "한글 본문");

		const out = newCapture();
		await readChapter(1, { cwd: tmp, stdout: out });

		expect(out.lines.join("")).toBe("한글 본문");
	});

	it("throws when the chapter file does not exist", async () => {
		const out = newCapture();
		await expect(readChapter(99, { cwd: tmp, stdout: out })).rejects.toThrow();
	});
});

describe("listChapters", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-list-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("reports zero chapters when the directory is empty or missing", async () => {
		const out = newCapture();
		await listChapters({ cwd: tmp, stdout: out });

		expect(out.lines.join("")).toContain("0");
	});

	it("lists each chapter file with its character count", async () => {
		await writeChapter(tmp, 1, "ab");
		await writeChapter(tmp, 2, "abcde");

		const out = newCapture();
		await listChapters({ cwd: tmp, stdout: out });

		const joined = out.lines.join("");
		expect(joined).toContain("001");
		expect(joined).toContain("2");
		expect(joined).toContain("002");
		expect(joined).toContain("5");
	});
});

describe("showStatus", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-status-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("reports zero chapters and unknown next chapter when nothing is written", async () => {
		await writeBible(tmp, [{ n: 1, title: "첫 만남" }]);

		const out = newCapture();
		await showStatus({ cwd: tmp, stdout: out });

		const joined = out.lines.join("");
		expect(joined).toContain("Chapters written: 0");
		expect(joined).toContain("Next: 1");
	});

	it("reports the count of written chapters and the next chapter number", async () => {
		await writeBible(tmp, [
			{ n: 1, title: "첫 만남" },
			{ n: 2, title: "두 번째" },
			{ n: 3, title: "세 번째" },
		]);
		await writeChapter(tmp, 1, "a");
		await writeChapter(tmp, 2, "a");

		const out = newCapture();
		await showStatus({ cwd: tmp, stdout: out });

		const joined = out.lines.join("");
		expect(joined).toContain("Chapters written: 2");
		expect(joined).toContain("Next: 3");
	});
});
