import { promises as fs } from "node:fs";
import path from "node:path";
import {
	type WorldData,
	type WorldLocation,
	type WorldProp,
	type WorldTimelineEntry,
	worldDataSchema,
} from "./world-types.js";

/**
 * Parse bible/world.md into a structured WorldData object.
 *
 * Format (per docs/validation-future-work.md):
 *
 *   ## 공간
 *   - 분식집: 1층 (101호)
 *   - 도윤: 302호 (3층)
 *
 *   ## 소품 규칙
 *   - 출입: 도어락. 열쇠 ❌
 *   - 통신: 카톡, 전화
 *
 *   ## 타임라인
 *   - 입국: 9월 / 귀국: 3월 / 총 6개월
 *
 * The parser is intentionally forgiving: unparseable lines are skipped
 * silently. Missing sections return empty arrays.
 */

const SECTION_HEADERS: Record<string, "locations" | "props" | "timeline"> = {
	공간: "locations",
	locations: "locations",
	location: "locations",
	소품: "props",
	props: "props",
	"소품 규칙": "props",
	타임라인: "timeline",
	timeline: "timeline",
};

const FLOOR_PATTERNS: Array<{ re: RegExp; group: number }> = [
	{ re: /(\d+)\s*층/, group: 1 },
	{ re: /(\d+)\s*F/i, group: 1 },
	{ re: /(\d+)\s*th\s+floor/i, group: 1 },
];

const ROOM_PATTERN = /(\d{2,4})\s*호/;

const DURATION_PATTERNS: Array<{ re: RegExp; months: number }> = [
	{ re: /(\d+)\s*년/, months: 12 },
	{ re: /(\d+)\s*개월/, months: 1 },
	{ re: /(\d+)\s*주/, months: 0.25 },
];

const FORBIDDEN_MARKERS = ["❌", "금지", "X", "없음", "no "];

export async function loadWorld(bibleDir: string): Promise<WorldData> {
	const file = path.join(bibleDir, "world.md");
	let raw: string;
	try {
		raw = await fs.readFile(file, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return worldDataSchema.parse({});
		}
		throw err;
	}
	return parseWorld(raw);
}

export function parseWorld(raw: string): WorldData {
	const lines = raw.split(/\r?\n/);
	const locations: WorldLocation[] = [];
	const props: WorldProp[] = [];
	const timeline: WorldTimelineEntry[] = [];

	let currentSection: "locations" | "props" | "timeline" | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("#")) {
			const headerText = trimmed.replace(/^#+\s*/, "");
			const key = Object.keys(SECTION_HEADERS).find((k) =>
				headerText.toLowerCase().includes(k.toLowerCase()),
			);
			currentSection = key ? (SECTION_HEADERS[key] ?? null) : null;
			continue;
		}

		if (!trimmed.startsWith("-") && !trimmed.startsWith("*")) continue;
		const body = trimmed.replace(/^[-*]\s*/, "").trim();
		if (!body) continue;

		if (currentSection === "locations") {
			const loc = parseLocation(body);
			if (loc) locations.push(loc);
		} else if (currentSection === "props") {
			const prop = parseProp(body);
			if (prop) props.push(prop);
		} else if (currentSection === "timeline") {
			const entry = parseTimelineEntry(body);
			if (entry) timeline.push(entry);
		}
	}

	return worldDataSchema.parse({ locations, props, timeline });
}

function parseLocation(body: string): WorldLocation | null {
	const nameMatch = body.match(/^([^:(]+)/);
	const nameRaw = nameMatch?.[1];
	if (!nameRaw) return null;
	const name = nameRaw.trim();
	if (!name) return null;

	let floor: number | undefined;
	for (const { re, group } of FLOOR_PATTERNS) {
		const m = body.match(re);
		if (m) {
			floor = Number.parseInt(m[group] ?? "", 10);
			if (Number.isFinite(floor)) break;
			floor = undefined;
		}
	}

	let room: number | undefined;
	const roomMatch = body.match(ROOM_PATTERN);
	if (roomMatch) {
		room = Number.parseInt(roomMatch[1] ?? "", 10);
	}

	// If a 3-digit room number exists, derive floor from hundreds digit when
	// no explicit floor was given ("301호" implies 3층 in Korean addressing).
	if (floor === undefined && room !== undefined && room >= 100) {
		floor = Math.floor(room / 100);
	}

	return { name, floor, room, raw: body };
}

function parseProp(body: string): WorldProp | null {
	// Format: "name: detail" or "name — detail"
	const m = body.match(/^([^:—-]+?)[:：]\s*(.+)$/);
	const name = m?.[1]?.trim();
	const detail = m?.[2]?.trim();
	if (!name || !detail) return null;
	const allowed = !FORBIDDEN_MARKERS.some((marker) => detail.includes(marker));
	return { name, allowed, raw: body };
}

function parseTimelineEntry(body: string): WorldTimelineEntry {
	const labelMatch = body.match(/^([^:：/]+)/);
	const label = labelMatch?.[1]?.trim() ?? body;

	let start: string | undefined;
	let end: string | undefined;
	const slashParts = body.split("/").map((s) => s.trim());
	for (const part of slashParts) {
		const startMatch = part.match(/(?:입국|시작|start|from)[:：]?\s*(.+)/i);
		const endMatch = part.match(/(?:귀국|끝|종료|end|to)[:：]?\s*(.+)/i);
		const startCaptured = startMatch?.[1]?.trim();
		const endCaptured = endMatch?.[1]?.trim();
		if (startCaptured && !start) start = startCaptured;
		if (endCaptured && !end) end = endCaptured;
	}

	let durationMonths: number | undefined;
	for (const { re, months } of DURATION_PATTERNS) {
		const m = body.match(re);
		if (m) {
			const value = Number.parseInt(m[1] ?? "", 10);
			if (Number.isFinite(value)) {
				durationMonths = value * months;
				break;
			}
		}
	}

	return { label, start, end, durationMonths, raw: body };
}
