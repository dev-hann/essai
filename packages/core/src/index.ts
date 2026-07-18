// Config

export { loadBible } from "./bible/loader.js";
// Bible
export {
	findEmotionStage,
	parseChapterRange,
	parseChapters,
	parseCharacters,
	parseEmotion,
	parseList,
	parseRelationships,
} from "./bible/parser.js";
export type {
	ParsedTemplate,
	Template,
	TemplateName,
} from "./bible/templates.js";
export {
	isSupportedTemplateName,
	listTemplates,
	loadTemplate,
	parseTemplateFrontmatter,
	TEMPLATE_NAMES,
} from "./bible/templates.js";
export type {
	BibleData,
	ChapterPlan,
	Character,
	EmotionStage,
	Relationship,
} from "./bible/types.js";
export { ProjectConfig } from "./config/project-config.js";
export type { LlmConfigData, ProjectConfigData } from "./config/schema.js";
export { llmConfigSchema, projectConfigSchema } from "./config/schema.js";
export type {
	ChapterEditorOptions,
	PartialRewriteOptions,
} from "./editor/chapter-editor.js";
// Editor
export { ChapterEditor } from "./editor/chapter-editor.js";
export type { SystemPromptOptions } from "./llm/craft-rules.js";
// Craft rules
export {
	buildLanguageDirective,
	buildSystemPrompt,
	CRAFT_RULES,
} from "./llm/craft-rules.js";
export type { WriterPrompt, WriterPromptOptions } from "./llm/prompts.js";
// Prompts
export { buildWriterPrompt } from "./llm/prompts.js";
// LLM provider
export { createModel } from "./llm/provider.js";
export { MemoryStore } from "./memory/memory-store.js";
export { Summarizer } from "./memory/summarizer.js";
export type {
	ChapterMemory,
	CharacterState,
	EmotionIntensity,
	ForeshadowingStatus,
	MemoryEmotion,
	MemoryEntry,
	MemoryForeshadowing,
} from "./memory/types.js";
// Memory
export {
	chapterMemorySchema,
	characterStateSchema,
	emotionIntensitySchema,
	foreshadowingStatusSchema,
	memoryEmotionSchema,
	memoryForeshadowingSchema,
} from "./memory/types.js";
export type { ReviewOptions } from "./reviewer/chapter-reviewer.js";
// Reviewer
export { ChapterReviewer } from "./reviewer/chapter-reviewer.js";
export type {
	WriteChapterOptions,
	WriteChapterResult,
} from "./writer/chapter-writer.js";
// Writer
export { ChapterWriter } from "./writer/chapter-writer.js";

export const CORE_VERSION = "0.0.0";
