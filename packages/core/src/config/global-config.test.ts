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
	projects: [{ name: "novel-a", path: "/home/user/novel-a" }],
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
			{ name: "novel-a", path: "/home/user/novel-a" },
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
			projects: [{ name: "novel-a", path: "/home/user/novel-a" }],
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
			{ name: "novel-a", path: "/home/user/novel-a" },
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
			projects: [{ name: "rt", path: "/tmp/rt" }],
		});

		await original.save(home);
		const reloaded = await GlobalConfig.load(home);

		expect(reloaded.toJSON()).toEqual(original.toJSON());
	});
});

describe("GlobalConfig.addProject", () => {
	it("appends a new project to the list", () => {
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

		expect(cfg.listProjects()).toEqual([
			{ name: "novel-a", path: "/home/user/novel-a" },
		]);
	});

	it("replaces an existing project with the same path", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [{ name: "old-name", path: "/home/user/novel-a" }],
		});

		cfg.addProject("new-name", "/home/user/novel-a");

		expect(cfg.listProjects()).toEqual([
			{ name: "new-name", path: "/home/user/novel-a" },
		]);
	});

	it("replaces an existing project with the same name", () => {
		const cfg = new GlobalConfig({
			defaultLanguage: "en",
			defaultModel: "",
			defaultBaseUrl: "",
			defaultApiKey: "",
			defaultChapterWords: 3000,
			defaultTemperature: 0.7,
			projects: [{ name: "novel-a", path: "/old/path" }],
		});

		cfg.addProject("novel-a", "/new/path");

		expect(cfg.listProjects()).toEqual([
			{ name: "novel-a", path: "/new/path" },
		]);
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
				{ name: "novel-a", path: "/a" },
				{ name: "novel-b", path: "/b" },
			],
		});

		cfg.addProject("novel-a", "/a-updated");

		expect(cfg.listProjects()).toEqual([
			{ name: "novel-b", path: "/b" },
			{ name: "novel-a", path: "/a-updated" },
		]);
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
			projects: [{ name: "novel-a", path: "/a" }],
		});

		const list = cfg.listProjects();
		list.push({ name: "injected", path: "/x" });

		expect(cfg.listProjects()).toEqual([{ name: "novel-a", path: "/a" }]);
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
			projects: [{ name: "novel-a", path: "/home/user/novel-a" }],
		});

		expect(cfg.toJSON()).toEqual({
			defaultLanguage: "ko",
			defaultModel: "glm-5.1",
			defaultBaseUrl: "https://api.example.com/v4",
			defaultApiKey: "secret-key",
			defaultChapterWords: 5000,
			defaultTemperature: 0.4,
			projects: [{ name: "novel-a", path: "/home/user/novel-a" }],
		});
	});
});
