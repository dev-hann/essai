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

export const chapterMemorySchema = z.object({
	chapter: z.number(),
	title: z.string(),
	wordCount: z.number(),
	events: z.array(z.string()),
	emotions: z.array(memoryEmotionSchema),
	foreshadowing: z.array(memoryForeshadowingSchema),
	facts: z.array(z.string()),
	characterState: z.record(z.string(), characterStateSchema),
});

export type ChapterMemory = z.infer<typeof chapterMemorySchema>;
export type MemoryEntry = ChapterMemory;
export type EmotionIntensity = z.infer<typeof emotionIntensitySchema>;
export type ForeshadowingStatus = z.infer<typeof foreshadowingStatusSchema>;
export type MemoryEmotion = z.infer<typeof memoryEmotionSchema>;
export type MemoryForeshadowing = z.infer<typeof memoryForeshadowingSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
