import { z } from "zod";

/**
 * World data — author-defined facts about the story world.
 *
 * Source: bible/world.md (optional). When present, the static validator
 * uses it to catch continuity bugs the LLM summarizer would otherwise
 * miss: e.g. "도윤 302호 (3층)" + "산링 301호 (3층)" + text "벽 하나 사이"
 * when they're on different floors; or "출입: 도어락. 열쇠 ❌" + text "열쇠".
 *
 * The shape is intentionally permissive: the parser accepts bullet-list
 * markdown and never throws. Missing sections simply skip those checks.
 */

export const worldLocationSchema = z.object({
	/** Raw label as written by the author, e.g. "도윤" or "분식집". */
	name: z.string(),
	/** Floor number parsed from parenthetical "(3층)" / "3F" / "301호". */
	floor: z.number().int().optional(),
	/** Room number if present, e.g. 302 from "302호". */
	room: z.number().int().optional(),
	/** Original raw text for diagnostics. */
	raw: z.string(),
});

export const worldPropSchema = z.object({
	name: z.string(),
	/** true when the prop is allowed, false when explicitly forbidden. */
	allowed: z.boolean(),
	raw: z.string(),
});

export const worldTimelineEntrySchema = z.object({
	label: z.string(),
	/** ISO-ish anchor like "2026-09" or "화요일" — kept as raw string. */
	start: z.string().optional(),
	end: z.string().optional(),
	/** Months/weeks/days duration, parsed from "6개월" / "1년" etc. */
	durationMonths: z.number().optional(),
	raw: z.string(),
});

export const worldDataSchema = z.object({
	locations: z.array(worldLocationSchema).default([]),
	props: z.array(worldPropSchema).default([]),
	timeline: z.array(worldTimelineEntrySchema).default([]),
});

export type WorldLocation = z.infer<typeof worldLocationSchema>;
export type WorldProp = z.infer<typeof worldPropSchema>;
export type WorldTimelineEntry = z.infer<typeof worldTimelineEntrySchema>;
export type WorldData = z.infer<typeof worldDataSchema>;
