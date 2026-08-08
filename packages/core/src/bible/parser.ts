import type {
	ChapterPlan,
	Character,
	EmotionStage,
	Relationship,
} from "./types.js";

const HEADER_PREFIX = "##";

function splitSections(md: string): { heading: string; body: string }[] {
	const lines = md.split(/\r?\n/);
	const sections: { heading: string; body: string }[] = [];
	let current: { heading: string; body: string } | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith(HEADER_PREFIX)) {
			if (current) sections.push(current);
			current = {
				heading: trimmed.slice(HEADER_PREFIX.length).trim(),
				body: "",
			};
		} else if (current) {
			current.body = current.body ? `${current.body}\n${line}` : line;
		}
	}
	if (current) sections.push(current);
	return sections;
}

function parseKeyValueMap(body: string): Record<string, string> {
	const map: Record<string, string> = {};
	for (const rawLine of body.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line.startsWith("-")) continue;
		const content = line.replace(/^-\s*/, "");
		const colon = content.indexOf(":");
		if (colon === -1) continue;
		const key = content.slice(0, colon).trim();
		const value = content.slice(colon + 1).trim();
		if (key) map[key] = value;
	}
	return map;
}

export function parseCharacters(md: string): Record<string, Character> {
	const result: Record<string, Character> = {};
	for (const section of splitSections(md)) {
		const name = section.heading;
		if (!name) continue;
		result[name] = parseKeyValueMap(section.body);
	}
	return result;
}

const RELATIONSHIP_RE = /^-\s*(.+?)\s*(?:→|->)\s*(.+?)\s*:\s*(.+)$/;

export function parseRelationships(md: string): Relationship[] {
	const relationships: Relationship[] = [];
	for (const rawLine of md.split(/\r?\n/)) {
		const line = rawLine.trim();
		const match = line.match(RELATIONSHIP_RE);
		if (!match) continue;
		relationships.push({
			from: (match[1] ?? "").trim(),
			to: (match[2] ?? "").trim(),
			description: (match[3] ?? "").trim(),
		});
	}
	return relationships;
}

const EMOTION_HEADER_RE = /^(\d+)단계\s*[-—–]\s*(.+?)\s*\(([^)]+)\)\s*$/;

export function parseEmotion(md: string): EmotionStage[] {
	const stages: EmotionStage[] = [];
	for (const section of splitSections(md)) {
		const match = section.heading.match(EMOTION_HEADER_RE);
		if (!match) continue;
		stages.push({
			stage: Number(match[1] ?? "0"),
			name: (match[2] ?? "").trim(),
			chapters: (match[3] ?? "").trim(),
			emotions: parseKeyValueMap(section.body),
		});
	}
	return stages;
}

const CHAPTER_HEADER_RE = /^(\d+)화\s*:\s*(.+)$/;

export function parseChapters(md: string): Map<number, ChapterPlan> {
	const chapters = new Map<number, ChapterPlan>();
	for (const section of splitSections(md)) {
		const match = section.heading.match(CHAPTER_HEADER_RE);
		if (!match) continue;
		const number = Number(match[1] ?? "0");
		chapters.set(number, {
			number,
			title: (match[2] ?? "").trim(),
			scenes: parseList(section.body),
		});
	}
	return chapters;
}

export function parseList(md: string): string[] {
	const items: string[] = [];
	for (const rawLine of md.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line.startsWith("-")) continue;
		items.push(line.replace(/^-\s*/, "").trim());
	}
	return items;
}

const CHAPTER_RANGE_RE = /(\d+)\s*(?:[~\-–—]|to)\s*(\d+)/;
const CHAPTER_SINGLE_RE = /(\d+)/;

export function parseChapterRange(
	raw: string,
): { start: number; end: number } | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const rangeMatch = trimmed.match(CHAPTER_RANGE_RE);
	if (rangeMatch) {
		const start = Number(rangeMatch[1] ?? NaN);
		const end = Number(rangeMatch[2] ?? NaN);
		if (Number.isFinite(start) && Number.isFinite(end)) {
			return { start, end: Math.max(start, end) };
		}
	}

	const singleMatch = trimmed.match(CHAPTER_SINGLE_RE);
	if (singleMatch) {
		const n = Number(singleMatch[1] ?? NaN);
		if (Number.isFinite(n)) return { start: n, end: n };
	}

	return null;
}

export function findEmotionStage(
	stages: readonly EmotionStage[],
	chapter: number,
): EmotionStage | null {
	for (const stage of stages) {
		const range = parseChapterRange(stage.chapters);
		if (!range) continue;
		if (chapter >= range.start && chapter <= range.end) return stage;
	}
	return null;
}
