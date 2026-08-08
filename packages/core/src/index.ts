import { createRequire } from "node:module";

// Config

export type { BibleAgentCallbacks } from "./bible/bible-agent.js";
// Bible Agent
export { BibleAgent } from "./bible/bible-agent.js";
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
export { GlobalConfig } from "./config/global-config.js";
export { ProjectConfig } from "./config/project-config.js";
export type {
	GlobalConfigData,
	GlobalProjectEntry,
	LlmConfigData,
	ProjectConfigData,
} from "./config/schema.js";
export {
	globalConfigSchema,
	globalProjectEntrySchema,
	llmConfigSchema,
	projectConfigSchema,
} from "./config/schema.js";
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
export type { CharacterAliasMap } from "./memory/alias-resolver.js";
export {
	parseAliasesFromCharactersMd,
	resolveCharacterAliases,
} from "./memory/alias-resolver.js";
export { MemoryStore } from "./memory/memory-store.js";
export { Summarizer } from "./memory/summarizer.js";
export type {
	ChapterMemory,
	CharacterState,
	EmotionIntensity,
	ForeshadowingStatus,
	LanguageLevel,
	MemoryEmotion,
	MemoryEntry,
	MemoryForeshadowing,
	TimelinePosition,
} from "./memory/types.js";
// Memory
export {
	chapterMemorySchema,
	characterStateSchema,
	emotionIntensitySchema,
	foreshadowingStatusSchema,
	languageLevelSchema,
	memoryEmotionSchema,
	memoryForeshadowingSchema,
	timelinePositionSchema,
} from "./memory/types.js";
export type {
	PipelineOptions,
	PipelineResult,
	PipelineStage,
	PipelineStepResult,
} from "./pipeline/write-pipeline.js";
// Pipeline
export { runWritePipeline } from "./pipeline/write-pipeline.js";
// AI Tells
export { detectAITells } from "./reviewer/ai-tells.js";
export type {
	ReviewOptions,
	ReviewResult,
} from "./reviewer/chapter-reviewer.js";
// Reviewer
export { ChapterReviewer } from "./reviewer/chapter-reviewer.js";
export type {
	AuditDimensionId,
	AuditOptions,
} from "./validator/continuity-auditor.js";
export {
	AUDIT_DIMENSIONS,
	ContinuityAuditor,
} from "./validator/continuity-auditor.js";
export type {
	StaticValidatorOptions,
	ValidationFinding,
	ValidationSeverity,
} from "./validator/static-validator.js";
export { StaticValidator } from "./validator/static-validator.js";
// Validator (static continuity checks + world.md parser)
export { loadWorld, parseWorld } from "./validator/world-parser.js";
export type {
	WorldData,
	WorldLocation,
	WorldProp,
	WorldTimelineEntry,
} from "./validator/world-types.js";
export {
	worldDataSchema,
	worldLocationSchema,
	worldPropSchema,
	worldTimelineEntrySchema,
} from "./validator/world-types.js";
export type {
	WriteChapterOptions,
	WriteChapterResult,
} from "./writer/chapter-writer.js";
// Writer
export { ChapterWriter } from "./writer/chapter-writer.js";

// Resolve the version dynamically from the published package.json so a
// future version bump doesn't require touching source. createRequire is
// used because the build target is ESM but package.json is consumed as CJS.
// The require runs relative to the compiled dist/index.js, so the manifest
// is one directory up.
const requireFromHere = createRequire(import.meta.url);
const coreManifest = requireFromHere("../package.json") as {
	version?: string;
};
export const CORE_VERSION = coreManifest.version ?? "0.0.0";
