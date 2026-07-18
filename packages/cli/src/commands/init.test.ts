import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject } from "./init.js";

describe("createProject", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-init-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("creates a project directory with the given name under cwd", async () => {
		const projectPath = await createProject("my-novel", { cwd: tmp });

		expect(projectPath).toBe(path.join(tmp, "my-novel"));
		const stat = await fs.stat(projectPath);
		expect(stat.isDirectory()).toBe(true);
	});

	it("creates the project in cwd itself when name is omitted", async () => {
		const projectPath = await createProject(undefined, { cwd: tmp });

		expect(projectPath).toBe(tmp);
	});

	it("writes essai.json with default config", async () => {
		await createProject("my-novel", { cwd: tmp });

		const raw = await fs.readFile(
			path.join(tmp, "my-novel", "essai.json"),
			"utf-8",
		);
		const config = JSON.parse(raw);
		expect(config.name).toBe("my-novel");
		expect(config.language).toBe("en");
		expect(config.chapterWords).toBe(3000);
		expect(config.llm).toBeDefined();
		expect(config.llm.model).toBe("");
	});

	it("creates empty bible/, chapters/, memory/, exports/ directories", async () => {
		await createProject("my-novel", { cwd: tmp });

		for (const dir of ["bible", "chapters", "memory", "exports"]) {
			const stat = await fs.stat(path.join(tmp, "my-novel", dir));
			expect(stat.isDirectory()).toBe(true);
		}
	});

	it("writes placeholder bible markdown files", async () => {
		await createProject("my-novel", { cwd: tmp });

		const characters = await fs.readFile(
			path.join(tmp, "my-novel", "bible", "characters.md"),
			"utf-8",
		);
		expect(characters.length).toBeGreaterThan(0);
	});

	it("fails if the target directory already exists", async () => {
		await fs.mkdir(path.join(tmp, "exists"));
		await expect(createProject("exists", { cwd: tmp })).rejects.toThrow();
	});
});
