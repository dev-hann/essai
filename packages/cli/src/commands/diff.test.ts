import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diffCommand } from "./diff.js";

function capture(): { output: string; write(c: string): void } {
	let output = "";
	return {
		get output() {
			return output;
		},
		write(c: string) {
			output += c;
		},
	};
}

describe("diff command", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-diff-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("warns when no .bak exists", async () => {
		const chaptersDir = path.join(tmp, "chapters");
		await fs.mkdir(chaptersDir, { recursive: true });
		await fs.writeFile(path.join(chaptersDir, "001.md"), "x", "utf-8");

		const out = capture();
		await diffCommand(1, { cwd: tmp, stdout: out });
		expect(out.output).toMatch(/No \.bak file/);
	});

	it("prints a unified diff with + and - markers", async () => {
		const chaptersDir = path.join(tmp, "chapters");
		await fs.mkdir(chaptersDir, { recursive: true });
		await fs.writeFile(
			path.join(chaptersDir, "001.md.bak"),
			"비가 내렸다.\n도윤은 카페에 앉았다.\n",
			"utf-8",
		);
		await fs.writeFile(
			path.join(chaptersDir, "001.md"),
			"비가 내렸다.\n지아는 카페에 앉았다.\n",
			"utf-8",
		);

		const out = capture();
		await diffCommand(1, { cwd: tmp, stdout: out });
		expect(out.output).toMatch(/chapters\/001\.md\.bak → chapters\/001\.md/);
		expect(out.output).toContain("-도윤은 카페에 앉았다.");
		expect(out.output).toContain("+지아는 카페에 앉았다.");
		expect(out.output).toContain(" 비가 내렸다.");
	});

	it("reports identical files with zero additions/removals", async () => {
		const chaptersDir = path.join(tmp, "chapters");
		await fs.mkdir(chaptersDir, { recursive: true });
		const content = "같은 내용\n";
		await fs.writeFile(path.join(chaptersDir, "001.md.bak"), content, "utf-8");
		await fs.writeFile(path.join(chaptersDir, "001.md"), content, "utf-8");

		const out = capture();
		await diffCommand(1, { cwd: tmp, stdout: out });
		expect(out.output).toMatch(/\+0 -0/);
		expect(out.output).not.toMatch(/^[+-]/m);
	});

	it("throws when the chapter file is missing", async () => {
		const out = capture();
		await expect(diffCommand(99, { cwd: tmp, stdout: out })).rejects.toThrow(
			/not found/,
		);
	});
});
