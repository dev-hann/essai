import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GlobalConfig } from "./global-config.js";

async function tmpHome(): Promise<string> {
	return await fs.mkdtemp(path.join(os.tmpdir(), "essai-global-"));
}

const SAMPLE_CONFIG = {
	defaultLanguage: "ko",
	defaultModel: "glm-5.1",
	defaultBaseUrl: "https://api.example.com/v4",
	defaultApiKey: "secret-key",
	defaultChapterWords: 5000,
	defaultTemperature: 0.4,
	projects: [{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" }],
};

async function writeGlobalConfig(
	homeDir: string,
	data: unknown,
): Promise<void> {
	const dir = path.join(homeDir, ".essai");
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(
		path.join(dir, "config.json"),
		JSON.stringify(data),
		"utf-8",
	);
}

describe("GlobalConfig.configPath", () => {
	it("points at <home>/.essai/config.json", () => {
		expect(GlobalConfig.configPath("/home/user")).toBe(
			path.join("/home/user", ".essai", "config.json"),
		);
	});
});

describe("GlobalConfig.load", () => {
	let home: string;

	beforeEach(async () => {
		home = await tmpHome();
	});

	afterEach(async () => {
		await fs.rm(home, { recursive: true, force: true });
	});

	it("returns defaults when ~/.essai/config.json does not exist", async () => {
		const cfg = await GlobalConfig.load(home);

		expect(cfg.defaultLanguage).toBe("en");
		expect(cfg.defaultModel).toBe("");
		expect(cfg.defaultBaseUrl).toBe("");
		expect(cfg.defaultApiKey).toBe("");
		expect(cfg.defaultChapterWords).toBe(3000);
		expect(cfg.defaultTemperature).toBe(0.7);
		expect(cfg.listProjects()).toEqual([]);
	});

	it("reads values from ~/.essai/config.json when it exists", async () => {
		await writeGlobalConfig(home, SAMPLE_CONFIG);

		const cfg = await GlobalConfig.load(home);

		expect(cfg.defaultLanguage).toBe("ko");
		expect(cfg.defaultModel).toBe("glm-5.1");
		expect(cfg.defaultBaseUrl).toBe("https://api.example.com/v4");
		expect(cfg.defaultApiKey).toBe("secret-key");
		expect(cfg.defaultChapterWords).toBe(5000);
		expect(cfg.defaultTemperature).toBe(0.4);
		expect(cfg.listProjects()).toEqual([
			{
				name: "novel-a",
				path: "/home/user/novel-a",
				id: "novel-a",
			},
		]);
	});

	it("preserves lastVisited when present on disk", async () => {
		await writeGlobalConfig(home, {
			...SAMPLE_CONFIG,
			projects: [
				{
					name: "novel-a",
					path: "/home/user/novel-a",
					id: "novel-a",
					lastVisited: "2026-01-01T00:00:00.000Z",
				},
			],
		});

		const cfg = await GlobalConfig.load(home);

		expect(cfg.listProjects()).toEqual([
			{
				name: "novel-a",
				path: "/home/user/novel-a",
				id: "novel-a",
				lastVisited: "2026-01-01T00:00:00.000Z",
			},
		]);
	});

	it("applies schema defaults for missing optional fields", async () => {
		await writeGlobalConfig(home, { defaultModel: "glm-5.1" });

		const cfg = await GlobalConfig.load(home);

		expect(cfg.defaultModel).toBe("glm-5.1");
		expect(cfg.defaultLanguage).toBe("en");
		expect(cfg.defaultChapterWords).toBe(3000);
		expect(cfg.listProjects()).toEqual([]);
	});

	it("throws ZodError when the file content is invalid", async () => {
		await writeGlobalConfig(home, { defaultChapterWords: "not-a-number" });

		await expect(GlobalConfig.load(home)).rejects.toThrow();
	});
});

describe("GlobalConfig.save", () => {
	let home: string;

	beforeEach(async () => {
		home = await tmpHome();
	});

	afterEach(async () => {
		await fs.rm(home, { recursive: true, force: true });
	});

	it("writes the config to <home>/.essai/config.json", async () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "ko",
			defaultModel: "glm-5.1",
			defaultBaseUrl: "https://api.example.com/v4",
			defaultApiKey: "secret-key",
			defaultChapterWords: 5000,
			defaultTemperature: 0.4,
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			],
		});

		await cfg.save(home);

		const raw = await fs.readFile(
			path.join(home, ".essai", "config.json"),
			"utf-8",
		);
		const parsed = JSON.parse(raw);

		expect(parsed.defaultLanguage).toBe("ko");
		expect(parsed.defaultModel).toBe("glm-5.1");
		expect(parsed.defaultApiKey).toBe("secret-key");
		expect(parsed.projects).toEqual([
			{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
		]);
	});

	it("creates the .essai directory if it does not exist", async () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [],
		});

		await cfg.save(home);

		const stat = await fs.stat(path.join(home, ".essai"));
		expect(stat.isDirectory()).toBe(true);
	});

	it("round-trips through load after save", async () => {
		const original = new GlobalConfig({
			defaultLanguage: "ja",
			defaultModel: "glm-5.2",
			defaultBaseUrl: "https://api.example.com/v4",
			defaultApiKey: "rt-secret",
			defaultChapterWords: 4200,
			defaultTemperature: 0.6,
			projects: [{ name: "rt", path: "/tmp/rt", id: "rt" }],
		});

		await original.save(home);
		const reloaded = await GlobalConfig.load(home);

		expect(reloaded.toJSON()).toEqual(original.toJSON());
	});

	it("round-trips lastVisited through save and load", async () => {
		const original = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{
					name: "rt",
					path: "/tmp/rt",
					id: "rt",
					lastVisited: "2026-07-20T12:00:00.000Z",
				},
			],
		});

		await original.save(home);
		const reloaded = await GlobalConfig.load(home);

		expect(reloaded.toJSON()).toEqual(original.toJSON());
	});
});

describe("GlobalConfig.generateProjectId", () => {
	it("returns an id prefixed by the basename of the project path", () => {
		const id = GlobalConfig.generateProjectId("novel-a", "/home/user/novel-a");

		expect(id).toMatch(/^novel-a-/);
		expect(id.length).toBeGreaterThan("novel-a-".length);
	});

	it("ignores trailing slashes when computing the basename", () => {
		const id = GlobalConfig.generateProjectId("novel-a", "/home/user/novel-a/");

		expect(id).toMatch(/^novel-a-/);
	});

	it("uses the last path segment as the prefix for nested paths", () => {
		const id = GlobalConfig.generateProjectId(
			"anything",
			"/Users/me/code/my-book",
		);

		expect(id).toMatch(/^my-book-/);
	});

	it("falls back to the name when the path basename is empty", () => {
		const id = GlobalConfig.generateProjectId("root-project", "/");

		expect(id).toMatch(/^root-project-/);
	});

	it("produces different ids on subsequent calls with the same arguments", () => {
		const a = GlobalConfig.generateProjectId("novel-a", "/home/user/novel-a");
		const b = GlobalConfig.generateProjectId("novel-a", "/home/user/novel-a");

		expect(a).not.toBe(b);
	});
});

describe("GlobalConfig.addProject", () => {
	it("appends a new project with an auto-generated id", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [],
		});

		cfg.addProject("novel-a", "/home/user/novel-a");

		const projects = cfg.listProjects();
		expect(projects).toHaveLength(1);
		expect(projects[0]?.name).toBe("novel-a");
		expect(projects[0]?.path).toBe("/home/user/novel-a");
		expect(projects[0]?.id).toMatch(/^novel-a-/);
	});

	it("does not set lastVisited on a freshly added project", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [],
		});

		cfg.addProject("novel-a", "/home/user/novel-a");

		const project = cfg.listProjects()[0];
		expect(project).toBeDefined();
		expect("lastVisited" in (project as object)).toBe(false);
	});

	it("replaces an existing project with the same path", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{ name: "old-name", path: "/home/user/novel-a", id: "old-name" },
			],
		});

		cfg.addProject("new-name", "/home/user/novel-a");

		const projects = cfg.listProjects();
		expect(projects).toHaveLength(1);
		expect(projects[0]?.name).toBe("new-name");
		expect(projects[0]?.path).toBe("/home/user/novel-a");
		expect(projects[0]?.id).toMatch(/^novel-a-/);
	});

	it("replaces an existing project with the same name", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [{ name: "novel-a", path: "/old/path", id: "old" }],
		});

		cfg.addProject("novel-a", "/new/path");

		const projects = cfg.listProjects();
		expect(projects).toHaveLength(1);
		expect(projects[0]?.name).toBe("novel-a");
		expect(projects[0]?.path).toBe("/new/path");
		expect(projects[0]?.id).toMatch(/^path-/);
	});

	it("preserves other projects when replacing a matching entry", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{ name: "novel-a", path: "/a", id: "a" },
				{ name: "novel-b", path: "/b", id: "b" },
			],
		});

		cfg.addProject("novel-a", "/a-updated");

		const projects = cfg.listProjects();
		expect(projects).toHaveLength(2);
		expect(projects[0]).toEqual({ name: "novel-b", path: "/b", id: "b" });
		expect(projects[1]?.name).toBe("novel-a");
		expect(projects[1]?.path).toBe("/a-updated");
		expect(projects[1]?.id).toMatch(/^a-updated-/);
	});
});

describe("GlobalConfig.getProject", () => {
	it("returns the project matching the id", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			],
		});

		expect(cfg.getProject("novel-a")).toEqual({
			name: "novel-a",
			path: "/home/user/novel-a",
			id: "novel-a",
		});
	});

	it("returns undefined when no project matches the id", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			],
		});

		expect(cfg.getProject("does-not-exist")).toBeUndefined();
	});

	it("returns a defensive copy (mutating result does not affect source)", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			],
		});

		const project = cfg.getProject("novel-a");
		expect(project).toBeDefined();
		(project as { name: string }).name = "tampered";

		expect(cfg.getProject("novel-a")?.name).toBe("novel-a");
	});
});

describe("GlobalConfig.updateLastVisited", () => {
	it("sets lastVisited on the project matching the id to an ISO timestamp", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			],
		});

		const before = Date.now();
		cfg.updateLastVisited("novel-a");
		const after = Date.now();

		const project = cfg.getProject("novel-a");
		expect(project?.lastVisited).toBeDefined();
		const visited = Date.parse(project?.lastVisited ?? "");
		expect(visited).not.toBeNaN();
		expect(visited).toBeGreaterThanOrEqual(before);
		expect(visited).toBeLessThanOrEqual(after);
	});

	it("overwrites a previously-set lastVisited value", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{
					name: "novel-a",
					path: "/home/user/novel-a",
					id: "novel-a",
					lastVisited: "2000-01-01T00:00:00.000Z",
				},
			],
		});

		cfg.updateLastVisited("novel-a");

		expect(cfg.getProject("novel-a")?.lastVisited).not.toBe(
			"2000-01-01T00:00:00.000Z",
		);
	});

	it("is a no-op when the id is unknown", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			],
		});

		cfg.updateLastVisited("does-not-exist");

		expect(cfg.getProject("novel-a")?.lastVisited).toBeUndefined();
	});

	it("does not affect other projects", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{ name: "novel-a", path: "/a", id: "a" },
				{ name: "novel-b", path: "/b", id: "b" },
			],
		});

		cfg.updateLastVisited("a");

		expect(cfg.getProject("a")?.lastVisited).toBeDefined();
		expect(cfg.getProject("b")?.lastVisited).toBeUndefined();
	});
});

describe("GlobalConfig.listProjects", () => {
	it("returns a defensive copy (mutating result does not affect source)", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [{ name: "novel-a", path: "/a", id: "a" }],
		});

		const list = cfg.listProjects();
		list.push({ name: "injected", path: "/x", id: "x" });

		expect(cfg.listProjects()).toEqual([
			{ name: "novel-a", path: "/a", id: "a" },
		]);
	});
});

describe("GlobalConfig.toJSON", () => {
	it("returns a serializable snapshot with all fields", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "ko",
			defaultModel: "glm-5.1",
			defaultBaseUrl: "https://api.example.com/v4",
			defaultApiKey: "secret-key",
			defaultChapterWords: 5000,
			defaultTemperature: 0.4,
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			],
		});

		expect(cfg.toJSON()).toEqual({
			defaultLanguage: "ko",
			defaultModel: "glm-5.1",
			defaultBaseUrl: "https://api.example.com/v4",
			defaultApiKey: "secret-key",
			defaultChapterWords: 5000,
			defaultTemperature: 0.4,
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			],
		});
	});

	it("includes lastVisited when set", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [
				{
					name: "novel-a",
					path: "/home/user/novel-a",
					id: "novel-a",
					lastVisited: "2026-07-20T12:00:00.000Z",
				},
			],
		});

		cfg.updateLastVisited("novel-a");

		expect(cfg.toJSON().projects[0]?.lastVisited).toBeDefined();
		expect(
			Date.parse(cfg.toJSON().projects[0]?.lastVisited ?? ""),
		).not.toBeNaN();
	});
});
