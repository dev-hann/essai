import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectConfig } from "./project-config.js";

async function tmpDir(): Promise<string> {
	return await fs.mkdtemp(path.join(os.tmpdir(), "essai-cfg-"));
}

describe("ProjectConfig.load", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await tmpDir();
	});

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("loads a valid essai.json", async () => {
		const config = {
			name: "my-novel",
			language: "ko",
			chapterWords: 4000,
			llm: {
				baseUrl: "https://api.example.com/v4",
				apiKey: "secret-key",
				model: "glm-5.1",
				temperature: 0.4,
				maxTokens: 2048,
				thinkingEnabled: true,
			},
		};
		await fs.writeFile(
			path.join(dir, "essai.json"),
			JSON.stringify(config),
			"utf-8",
		);

		const loaded = await ProjectConfig.load(dir);

		expect(loaded.name).toBe("my-novel");
		expect(loaded.language).toBe("ko");
		expect(loaded.chapterWords).toBe(4000);
		expect(loaded.llm.baseUrl).toBe("https://api.example.com/v4");
		expect(loaded.llm.apiKey).toBe("secret-key");
		expect(loaded.llm.model).toBe("glm-5.1");
		expect(loaded.llm.temperature).toBe(0.4);
		expect(loaded.llm.maxTokens).toBe(2048);
		expect(loaded.llm.thinkingEnabled).toBe(true);
	});

	it("throws ZodError when essai.json is invalid", async () => {
		await fs.writeFile(
			path.join(dir, "essai.json"),
			JSON.stringify({ name: "x" }),
			"utf-8",
		);

		await expect(ProjectConfig.load(dir)).rejects.toThrow();
	});

	it("throws when essai.json does not exist", async () => {
		await expect(ProjectConfig.load(dir)).rejects.toThrow();
	});
});

describe("ProjectConfig.save", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await tmpDir();
	});

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("writes essai.json with the apiKey masked as ***", async () => {
		const config = new ProjectConfig({
			name: "my-novel",
			language: "ko",
			chapterWords: 3000,
			llm: {
				baseUrl: "https://api.example.com/v4",
				apiKey: "super-secret-key",
				model: "glm-5.1",
				temperature: 0.7,
				maxTokens: 8000,
				thinkingEnabled: false,
			},
		});

		await config.save(dir);

		const written = JSON.parse(
			await fs.readFile(path.join(dir, "essai.json"), "utf-8"),
		) as Record<string, unknown>;
		const llm = written.llm as Record<string, unknown>;

		expect(llm.apiKey).toBe("***");
		expect(written.name).toBe("my-novel");
		expect(llm.model).toBe("glm-5.1");
		expect(llm.baseUrl).toBe("https://api.example.com/v4");
	});
});

describe("ProjectConfig.fromEnv", () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("reads values from ESSAI_* environment variables", () => {
		process.env.ESSAI_BASE_URL = "https://env.example.com/v4";
		process.env.ESSAI_API_KEY = "env-key";
		process.env.ESSAI_MODEL = "env-model";
		process.env.ESSAI_LANGUAGE = "ja";

		const cfg = ProjectConfig.fromEnv();

		expect(cfg.llm.baseUrl).toBe("https://env.example.com/v4");
		expect(cfg.llm.apiKey).toBe("env-key");
		expect(cfg.llm.model).toBe("env-model");
		expect(cfg.language).toBe("ja");
	});

	it("does not expose the real key through save()", async () => {
		const dir = await tmpDir();
		try {
			process.env.ESSAI_BASE_URL = "https://env.example.com/v4";
			process.env.ESSAI_API_KEY = "env-secret";
			process.env.ESSAI_MODEL = "env-model";
			process.env.ESSAI_LANGUAGE = "en";

			const cfg = ProjectConfig.fromEnv();
			await cfg.save(dir);

			const written = JSON.parse(
				await fs.readFile(path.join(dir, "essai.json"), "utf-8"),
			) as Record<string, unknown>;
			const llm = written.llm as Record<string, unknown>;

			expect(llm.apiKey).toBe("***");
			expect(cfg.llm.apiKey).toBe("env-secret");
		} finally {
			await fs.rm(dir, { recursive: true, force: true });
		}
	});
});
