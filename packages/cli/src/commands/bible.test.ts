import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@essai/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@essai/core")>();
	return {
		...actual,
		loadBible: vi.fn(),
	};
});

import {
	bibleAdd,
	bibleEdit,
	bibleInit,
	bibleShow,
	bibleValidate,
} from "./bible.js";

interface Captured {
	output: string;
	write(chunk: string): void;
}

function newCapture(): Captured {
	let output = "";
	return {
		get output() {
			return output;
		},
		write(chunk: string) {
			output += chunk;
		},
	};
}

const ROMANCE_TEMPLATE = `# Bible Template: Romance

---
agent:
  template: romance
  sections: [characters, relationships, conflict, emotion, chapters, style, tone, constraints]
---

## Characters

<!--
Example entry:

## 도윤
- age: 25
-->

## Relationships

<!--
- 도윤 → 지아: 호감
-->

## Conflict

<!--
external: distance
-->

## Emotion Curve

<!--
## 1단계 — 경계 (1~3화)
- 도윤: 호기심
-->

## Chapter Plans

<!--
## 1화: 첫 만남
- 카페에서 만남
-->

## Writing Style

- colloquial dialogue

## Tone & Mood

- gentle

## Constraints

- no explicit content
`;

describe("bible init", () => {
	let tmp: string;
	let templatesDir: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-bi-"));
		templatesDir = await fs.mkdtemp(path.join(os.tmpdir(), "essai-bi-tpls-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
		await fs.rm(templatesDir, { recursive: true, force: true });
	});

	it("creates the seven standard section files when no template is given", async () => {
		await bibleInit(undefined, { cwd: tmp, templatesDir });

		for (const name of [
			"characters.md",
			"relationships.md",
			"emotion.md",
			"chapters.md",
			"style.md",
			"tone.md",
			"constraints.md",
		]) {
			const stat = await fs.stat(path.join(tmp, "bible", name));
			expect(stat.isFile()).toBe(true);
		}
	});

	it("refuses to overwrite an existing non-empty characters.md", async () => {
		await fs.mkdir(path.join(tmp, "bible"));
		await fs.writeFile(
			path.join(tmp, "bible", "characters.md"),
			"## 도윤\n- age: 25\n",
			"utf-8",
		);

		await expect(
			bibleInit(undefined, { cwd: tmp, templatesDir }),
		).rejects.toThrow();
	});

	it("splits the chosen template into the standard section files", async () => {
		await fs.writeFile(
			path.join(templatesDir, "romance.md"),
			ROMANCE_TEMPLATE,
			"utf-8",
		);

		await bibleInit("romance", { cwd: tmp, templatesDir });

		const characters = await fs.readFile(
			path.join(tmp, "bible", "characters.md"),
			"utf-8",
		);
		// Example entries live inside HTML comments and are preserved as guidance
		expect(characters).toContain("도윤");
		expect(characters).toContain("age: 25");
		// The section header is kept
		expect(characters).toMatch(/^## Characters/m);

		const style = await fs.readFile(
			path.join(tmp, "bible", "style.md"),
			"utf-8",
		);
		// Real (non-comment) content is preserved verbatim
		expect(style).toContain("colloquial dialogue");

		const constraints = await fs.readFile(
			path.join(tmp, "bible", "constraints.md"),
			"utf-8",
		);
		expect(constraints).toContain("no explicit content");
	});

	it("writes unrecognized template sections as additional context files", async () => {
		await fs.writeFile(
			path.join(templatesDir, "romance.md"),
			ROMANCE_TEMPLATE,
			"utf-8",
		);

		await bibleInit("romance", { cwd: tmp, templatesDir });

		const conflict = await fs.readFile(
			path.join(tmp, "bible", "conflict.md"),
			"utf-8",
		);
		expect(conflict).toContain("distance");
	});

	it("prints a confirmation listing the written files", async () => {
		await fs.writeFile(
			path.join(templatesDir, "romance.md"),
			ROMANCE_TEMPLATE,
			"utf-8",
		);
		const out = newCapture();

		await bibleInit("romance", { cwd: tmp, templatesDir, stdout: out });

		expect(out.output).toMatch(/bible/i);
		expect(out.output).toContain("characters.md");
	});

	it("throws when the requested template is not supported", async () => {
		await expect(
			bibleInit("horror", { cwd: tmp, templatesDir }),
		).rejects.toThrow(/support/i);
	});
});

describe("bible show", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-bs-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("lists each bible file with its byte size", async () => {
		await fs.mkdir(path.join(tmp, "bible"));
		await fs.writeFile(
			path.join(tmp, "bible", "characters.md"),
			"## 도윤\n- age: 25\n",
			"utf-8",
		);
		await fs.writeFile(
			path.join(tmp, "bible", "style.md"),
			"- colloquial\n",
			"utf-8",
		);

		const out = newCapture();
		await bibleShow({ cwd: tmp, stdout: out });

		expect(out.output).toContain("characters.md");
		expect(out.output).toContain("style.md");
	});

	it("prints a helpful message when the bible directory is empty", async () => {
		const out = newCapture();
		await bibleShow({ cwd: tmp, stdout: out });

		expect(out.output).toMatch(/no.*bible|empty/i);
	});
});

describe("bible validate", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-bv-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("reports missing standard section files", async () => {
		await fs.mkdir(path.join(tmp, "bible"));
		await fs.writeFile(
			path.join(tmp, "bible", "characters.md"),
			"## 도윤\n- age: 25\n",
			"utf-8",
		);

		const result = await bibleValidate({ cwd: tmp });

		expect(result.ok).toBe(false);
		expect(result.missing).toContain("relationships.md");
		expect(result.missing).toContain("chapters.md");
	});

	it("reports section files that contain only comments or whitespace", async () => {
		await fs.mkdir(path.join(tmp, "bible"));
		for (const name of [
			"characters.md",
			"relationships.md",
			"emotion.md",
			"chapters.md",
			"style.md",
			"tone.md",
			"constraints.md",
		]) {
			await fs.writeFile(
				path.join(tmp, "bible", name),
				name === "characters.md"
					? "## 도윤\n- age: 25\n"
					: "<!-- only a comment -->\n",
				"utf-8",
			);
		}

		const result = await bibleValidate({ cwd: tmp });

		expect(result.empty).toContain("style.md");
		expect(result.empty).not.toContain("characters.md");
		expect(result.ok).toBe(false);
	});

	it("passes when every standard section file has real content", async () => {
		await fs.mkdir(path.join(tmp, "bible"));
		for (const name of [
			"characters.md",
			"relationships.md",
			"emotion.md",
			"chapters.md",
			"style.md",
			"tone.md",
			"constraints.md",
		]) {
			await fs.writeFile(
				path.join(tmp, "bible", name),
				`## real\n- content for ${name}\n`,
				"utf-8",
			);
		}

		const result = await bibleValidate({ cwd: tmp });
		expect(result.ok).toBe(true);
		expect(result.missing).toEqual([]);
		expect(result.empty).toEqual([]);
	});

	it("prints a summary to stdout", async () => {
		await fs.mkdir(path.join(tmp, "bible"));
		const out = newCapture();
		const result = await bibleValidate({ cwd: tmp, stdout: out });

		expect(out.output).toContain("missing");
		expect(out.output).toContain("characters.md");
		expect(result.ok).toBe(false);
	});
});

describe("bible edit", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-be-"));
		await fs.mkdir(path.join(tmp, "bible"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("spawns the editor on the bible directory when no file is given", async () => {
		const spawn = vi.fn().mockResolvedValue(undefined);
		const editor = "nano";

		await bibleEdit(undefined, { cwd: tmp, editor, spawn });

		expect(spawn).toHaveBeenCalledTimes(1);
		const [cmd, args] = spawn.mock.calls[0] ?? [];
		expect(cmd).toBe("nano");
		expect(args).toEqual([path.join(tmp, "bible")]);
	});

	it("spawns the editor on a specific file when given", async () => {
		const spawn = vi.fn().mockResolvedValue(undefined);

		await bibleEdit("characters", { cwd: tmp, editor: "code", spawn });

		const args = spawn.mock.calls[0]?.[1];
		expect(args).toEqual([path.join(tmp, "bible", "characters.md")]);
	});

	it("falls back to the EDITOR environment variable when editor is not provided", async () => {
		const original = process.env.EDITOR;
		process.env.EDITOR = "vim";
		try {
			const spawn = vi.fn().mockResolvedValue(undefined);
			await bibleEdit(undefined, { cwd: tmp, spawn });
			expect(spawn.mock.calls[0]?.[0]).toBe("vim");
		} finally {
			process.env.EDITOR = original;
		}
	});

	it("falls back to vi when no editor is configured", async () => {
		const original = process.env.EDITOR;
		delete process.env.EDITOR;
		try {
			const spawn = vi.fn().mockResolvedValue(undefined);
			await bibleEdit(undefined, { cwd: tmp, spawn });
			expect(spawn.mock.calls[0]?.[0]).toBe("vi");
		} finally {
			process.env.EDITOR = original;
		}
	});
});

describe("bible add", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-ba-"));
		await fs.mkdir(path.join(tmp, "bible"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("appends a new entry to characters.md via the prompt", async () => {
		await fs.writeFile(
			path.join(tmp, "bible", "characters.md"),
			"## 도윤\n- age: 25\n",
			"utf-8",
		);
		const prompt = vi
			.fn()
			.mockResolvedValueOnce("지아")
			.mockResolvedValueOnce("23")
			.mockResolvedValueOnce("워홀러");

		await bibleAdd("characters", {
			cwd: tmp,
			prompt,
			stdout: newCapture(),
		});

		const after = await fs.readFile(
			path.join(tmp, "bible", "characters.md"),
			"utf-8",
		);
		expect(after).toContain("지아");
		expect(after).toContain("23");
		expect(after).toContain("워홀러");
	});

	it("creates the section file if it does not exist", async () => {
		const prompt = vi.fn().mockResolvedValueOnce("Use short sentences");

		await bibleAdd("style", {
			cwd: tmp,
			prompt,
			stdout: newCapture(),
		});

		const after = await fs.readFile(
			path.join(tmp, "bible", "style.md"),
			"utf-8",
		);
		expect(after).toContain("Use short sentences");
	});

	it("prints a confirmation after appending", async () => {
		await fs.writeFile(
			path.join(tmp, "bible", "style.md"),
			"- existing\n",
			"utf-8",
		);
		const prompt = vi.fn().mockResolvedValueOnce("new rule");
		const out = newCapture();

		await bibleAdd("style", { cwd: tmp, prompt, stdout: out });

		expect(out.output).toMatch(/added|appended/i);
	});
});
