import { describe, expect, it } from "vitest";
import {
	globalConfigSchema,
	llmConfigSchema,
	projectConfigSchema,
} from "./schema.js";

describe("llmConfigSchema", () => {
	it("parses a fully-specified llm config", () => {
		const parsed = llmConfigSchema.parse({
			baseUrl: "https://api.example.com/v4",
			apiKey: "secret",
			model: "glm-5.1",
			temperature: 0.5,
			maxTokens: 4096,
			thinkingEnabled: true,
		});

		expect(parsed).toEqual({
			baseUrl: "https://api.example.com/v4",
			apiKey: "secret",
			model: "glm-5.1",
			temperature: 0.5,
			maxTokens: 4096,
			thinkingEnabled: true,
		});
	});

	it("applies defaults for optional fields", () => {
		const parsed = llmConfigSchema.parse({
			baseUrl: "https://api.example.com/v4",
			apiKey: "secret",
			model: "glm-5.1",
		});

		expect(parsed.temperature).toBe(0.7);
		expect(parsed.maxTokens).toBe(8000);
		expect(parsed.thinkingEnabled).toBe(false);
	});

	it("throws when required baseUrl is missing", () => {
		expect(() =>
			llmConfigSchema.parse({
				apiKey: "secret",
				model: "glm-5.1",
			}),
		).toThrow();
	});
});

describe("projectConfigSchema", () => {
	it("parses a valid config and applies defaults for language and chapterWords", () => {
		const parsed = projectConfigSchema.parse({
			name: "my-novel",
			llm: {
				baseUrl: "https://api.example.com/v4",
				apiKey: "secret",
				model: "glm-5.1",
			},
		});

		expect(parsed.name).toBe("my-novel");
		expect(parsed.language).toBe("en");
		expect(parsed.chapterWords).toBe(3000);
		expect(parsed.llm.model).toBe("glm-5.1");
	});

	it("preserves explicitly-provided language and chapterWords", () => {
		const parsed = projectConfigSchema.parse({
			name: "my-novel",
			language: "ko",
			chapterWords: 5000,
			llm: {
				baseUrl: "https://api.example.com/v4",
				apiKey: "secret",
				model: "glm-5.1",
			},
		});

		expect(parsed.language).toBe("ko");
		expect(parsed.chapterWords).toBe(5000);
	});

	it("throws a ZodError when llm block is missing entirely", () => {
		expect(() => projectConfigSchema.parse({ name: "my-novel" })).toThrow();
	});

	it("throws a ZodError when name is missing", () => {
		expect(() =>
			projectConfigSchema.parse({
				llm: {
					baseUrl: "https://api.example.com/v4",
					apiKey: "secret",
					model: "glm-5.1",
				},
			}),
		).toThrow();
	});
});

describe("globalConfigSchema", () => {
	it("applies defaults for an empty object", () => {
		const parsed = globalConfigSchema.parse({});

		expect(parsed.defaultLanguage).toBe("en");
		expect(parsed.defaultModel).toBe("");
		expect(parsed.defaultBaseUrl).toBe("");
		expect(parsed.defaultApiKey).toBe("");
		expect(parsed.defaultChapterWords).toBe(3000);
		expect(parsed.defaultTemperature).toBe(0.7);
		expect(parsed.projects).toEqual([]);
	});

	it("preserves explicitly-provided scalar values", () => {
		const parsed = globalConfigSchema.parse({
			defaultLanguage: "ko",
			defaultModel: "glm-5.1",
			defaultBaseUrl: "https://api.example.com/v4",
			defaultApiKey: "secret",
			defaultChapterWords: 5000,
			defaultTemperature: 0.4,
		});

		expect(parsed.defaultLanguage).toBe("ko");
		expect(parsed.defaultModel).toBe("glm-5.1");
		expect(parsed.defaultBaseUrl).toBe("https://api.example.com/v4");
		expect(parsed.defaultApiKey).toBe("secret");
		expect(parsed.defaultChapterWords).toBe(5000);
		expect(parsed.defaultTemperature).toBe(0.4);
	});

	it("parses a projects array of { name, path, id } entries", () => {
		const parsed = globalConfigSchema.parse({
			projects: [
				{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
				{ name: "novel-b", path: "/home/user/novel-b", id: "novel-b" },
			],
		});

		expect(parsed.projects).toEqual([
			{ name: "novel-a", path: "/home/user/novel-a", id: "novel-a" },
			{ name: "novel-b", path: "/home/user/novel-b", id: "novel-b" },
		]);
	});

	it("preserves lastVisited when provided", () => {
		const parsed = globalConfigSchema.parse({
			projects: [
				{
					name: "novel-a",
					path: "/home/user/novel-a",
					id: "novel-a",
					lastVisited: "2026-01-01T00:00:00.000Z",
				},
			],
		});

		expect(parsed.projects[0]?.lastVisited).toBe("2026-01-01T00:00:00.000Z");
	});

	it("defaults projects to an empty array when omitted", () => {
		const parsed = globalConfigSchema.parse({ defaultLanguage: "en" });

		expect(parsed.projects).toEqual([]);
	});

	it("throws a ZodError when a project is missing its path", () => {
		expect(() =>
			globalConfigSchema.parse({ projects: [{ name: "x", id: "x" }] }),
		).toThrow();
	});

	it("throws a ZodError when a project is missing its id", () => {
		expect(() =>
			globalConfigSchema.parse({
				projects: [{ name: "x", path: "/x" }],
			}),
		).toThrow();
	});
});
