import { z } from "zod";

export const emotionIntensitySchema = z.enum(["low", "medium", "high"]);

export const foreshadowingStatusSchema = z.enum([
	"unresolved",
	"active",
	"resolved",
]);

export const characterStateSchema = z.object({
	location: z.string(),
	mood: z.string(),
	knows: z.array(z.string()),
});

export const memoryEmotionSchema = z.object({
	character: z.string(),
	emotion: z.string(),
	intensity: emotionIntensitySchema,
	note: z.string().optional(),
});

export const memoryForeshadowingSchema = z.object({
	item: z.string(),
	status: foreshadowingStatusSchema,
	chapterIntroduced: z.number(),
});

/**
 * Where the chapter sits on the story timeline. Authors write timelines
 * inconsistently ("9월", "화요일", "3주 후") so we keep both a freeform
 * anchor string and an optional canonical label that downstream tools
 * (validator, auditor) can match against world.md timeline entries.
 */
export const timelinePositionSchema = z.object({
	/** Raw anchor as written by the LLM summarizer ("9월", "day 3", "화요일"). */
	month: z.string(),
	/**
	 * Optional reference point. Typically the previous chapter's
	 * timelinePosition.month, or a world.md timeline label like "입국".
	 */
	relativeTo: z.string().optional(),
});

export const languageLevelSchema = z.object({
	character: z.string(),
	/** CEFR-ish or descriptive level, e.g. "A2", "초급", "유창함". */
	level: z.string(),
	/** Optional note capturing a change ("막힘 → 짧은 문장 가능"). */
	note: z.string().optional(),
});

export const chapterMemorySchema = z.object({
	chapter: z.number(),
	title: z.string(),
	wordCount: z.number(),
	events: z.array(z.string()),
	emotions: z.array(memoryEmotionSchema),
	foreshadowing: z.array(memoryForeshadowingSchema),
	facts: z.array(z.string()),
	characterState: z.record(z.string(), characterStateSchema),
	/**
	 * Props introduced in this chapter that did not exist before. Useful for
	 * the auditor to detect "a gun on the table in ch7" that was never set
	 * up, and for tracking Chekhov's-gun setups across the work.
	 */
	propsIntroduced: z.array(z.string()).default([]),
	/** Props used (referenced) in this chapter, regardless of origin. */
	propsUsed: z.array(z.string()).default([]),
	/**
	 * Position on the story timeline. Omitted on the very first chapter
	 * (no anchor yet) and on chapters whose content did not surface a
	 * detectable temporal marker.
	 */
	timelinePosition: timelinePositionSchema.optional(),
	/**
	 * Per-character language proficiency snapshot, mainly for stories where
	 * a character's language ability evolves (e.g. 외국인 한국어 학습자,
	 * language-learner trope). Empty for most projects.
	 */
	languageLevel: z.array(languageLevelSchema).default([]),
});

export type ChapterMemory = z.infer<typeof chapterMemorySchema>;
export type MemoryEntry = ChapterMemory;
export type EmotionIntensity = z.infer<typeof emotionIntensitySchema>;
export type ForeshadowingStatus = z.infer<typeof foreshadowingStatusSchema>;
export type MemoryEmotion = z.infer<typeof memoryEmotionSchema>;
export type MemoryForeshadowing = z.infer<typeof memoryForeshadowingSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
export type TimelinePosition = z.infer<typeof timelinePositionSchema>;
export type LanguageLevel = z.infer<typeof languageLevelSchema>;
