import { z } from "zod";

export const llmConfigSchema = z.object({
	baseUrl: z.string(),
	apiKey: z.string(),
	model: z.string(),
	temperature: z.number().default(0.7),
	maxTokens: z.number().default(8000),
	thinkingEnabled: z.boolean().default(false),
});

export const projectConfigSchema = z.object({
	name: z.string(),
	language: z.string().default("en"),
	chapterWords: z.number().default(3000),
	llm: llmConfigSchema,
});

export const globalProjectEntrySchema = z.object({
	name: z.string(),
	path: z.string(),
});

export const globalConfigSchema = z.object({
	defaultLanguage: z.string().default("en"),
	defaultModel: z.string().default(""),
	defaultBaseUrl: z.string().default(""),
	defaultApiKey: z.string().default(""),
	defaultChapterWords: z.number().default(3000),
	defaultTemperature: z.number().default(0.7),
	projects: z.array(globalProjectEntrySchema).default([]),
});

export type LlmConfigData = z.infer<typeof llmConfigSchema>;
export type ProjectConfigData = z.infer<typeof projectConfigSchema>;
export type GlobalProjectEntry = z.infer<typeof globalProjectEntrySchema>;
export type GlobalConfigData = z.infer<typeof globalConfigSchema>;
