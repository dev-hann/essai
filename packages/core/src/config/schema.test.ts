import { describe, expect, it } from "vitest";
import { llmConfigSchema, projectConfigSchema } from "./schema.js";

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
