import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GlobalConfig } from "@essai/core";
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

	describe("global config integration", () => {
		let home: string;

		beforeEach(async () => {
			home = await fs.mkdtemp(path.join(os.tmpdir(), "essai-init-home-"));
		});

		afterEach(async () => {
			await fs.rm(home, { recursive: true, force: true });
		});

		it("copies model/apiKey/baseUrl/language from global config when it exists", async () => {
			const global = new GlobalConfig({
				defaultLanguage: "ko",
				defaultModel: "glm-5.1",
				defaultBaseUrl: "https://api.example.com/v4",
				defaultApiKey: "global-secret",
				defaultChapterWords: 3000,
				defaultTemperature: 0.7,
				projects: [],
			});
			await global.save(home);

			await createProject("my-novel", { cwd: tmp, homeDir: home });

			const raw = await fs.readFile(
				path.join(tmp, "my-novel", "essai.json"),
				"utf-8",
			);
			const projectConfig = JSON.parse(raw);

			expect(projectConfig.language).toBe("ko");
			expect(projectConfig.llm.model).toBe("glm-5.1");
			expect(projectConfig.llm.baseUrl).toBe("https://api.example.com/v4");
			expect(projectConfig.llm.apiKey).toBe("global-secret");
		});

		it("registers the new project in the global config projects list", async () => {
			const global = new GlobalConfig({
				defaultLanguage: "en",
				defaultModel: "",
				defaultBaseUrl: "",
				defaultApiKey: "",
				defaultChapterWords: 3000,
				defaultTemperature: 0.7,
				projects: [],
			});
			await global.save(home);

			await createProject("my-novel", { cwd: tmp, homeDir: home });

			const reloaded = await GlobalConfig.load(home);
			expect(reloaded.listProjects()).toEqual([
				{ name: "my-novel", path: path.join(tmp, "my-novel") },
			]);
		});

		it("leaves project defaults untouched when no global config exists", async () => {
			await createProject("my-novel", { cwd: tmp, homeDir: home });

			const raw = await fs.readFile(
				path.join(tmp, "my-novel", "essai.json"),
				"utf-8",
			);
			const projectConfig = JSON.parse(raw);

			expect(projectConfig.language).toBe("en");
			expect(projectConfig.llm.model).toBe("");
			expect(projectConfig.llm.apiKey).toBe("");

			await expect(GlobalConfig.load(home)).resolves.toBeDefined();
			const reloaded = await GlobalConfig.load(home);
			expect(reloaded.listProjects()).toEqual([]);
		});

		it("preserves existing global projects when registering a new one", async () => {
			const global = new GlobalConfig({
				defaultLanguage: "en",
				defaultModel: "",
				defaultBaseUrl: "",
				defaultApiKey: "",
				defaultChapterWords: 3000,
				defaultTemperature: 0.7,
				projects: [{ name: "prior", path: "/elsewhere/prior" }],
			});
			await global.save(home);

			await createProject("my-novel", { cwd: tmp, homeDir: home });

			const reloaded = await GlobalConfig.load(home);
			expect(reloaded.listProjects()).toContainEqual({
				name: "prior",
				path: "/elsewhere/prior",
			});
			expect(reloaded.listProjects()).toContainEqual({
				name: "my-novel",
				path: path.join(tmp, "my-novel"),
			});
		});
	});
});
