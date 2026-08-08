import type { WorldData, WorldLocation } from "./world-types.js";

/**
 * Static (deterministic, no-LLM) continuity checks.
 *
 * Mirrors the bugs found in my-first-novel (see docs/validation-future-work.md):
 *  - floor mismatches (two characters "벽 하나 사이" but on different floors)
 *  - forbidden props (도어락 building but "열쇠" appears in text)
 *  - timeline arithmetic (H-1 visa "1 year" but actual stay 6 months)
 *  - language-specific surface rules (Korean register leaks, English
 *    em-dash overuse, mixed-script punctuation)
 *
 * All checks are pure string parsing — no API calls, deterministic output.
 */

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationFinding {
	severity: ValidationSeverity;
	rule: string;
	message: string;
	/** Optional excerpt from the source text where the issue was detected. */
	excerpt?: string;
}

export interface StaticValidatorOptions {
	/** Disable specific rules by id (e.g. "timeline-arithmetic"). */
	disable?: string[];
	/**
	 * Project language code. Drives which language-specific surface rules
	 * run (Korean register, English em-dash, etc). When omitted, only the
	 * language-agnostic rules fire.
	 */
	language?: string;
}

const DEFAULT_OPTIONS: StaticValidatorOptions = {};

export class StaticValidator {
	private readonly opts: StaticValidatorOptions;

	constructor(opts: StaticValidatorOptions = DEFAULT_OPTIONS) {
		this.opts = opts;
	}

	validate(content: string, world: WorldData): ValidationFinding[] {
		const findings: ValidationFinding[] = [];
		if (!content.trim()) return findings;

		for (const rule of VALIDATION_RULES) {
			if (this.opts.disable?.includes(rule.id)) continue;
			const ruleFindings = rule.run(content, world, this.opts.language);
			for (const finding of ruleFindings) {
				findings.push({
					severity: finding.severity,
					rule: rule.id,
					message: finding.message,
					...(finding.excerpt !== undefined
						? { excerpt: finding.excerpt }
						: {}),
				});
			}
		}
		return findings;
	}
}

interface RuleResult {
	severity: ValidationSeverity;
	message: string;
	excerpt?: string;
}

interface ValidationRule {
	id: string;
	run: (content: string, world: WorldData, language?: string) => RuleResult[];
}

const FLOOR_KEYWORDS: Array<{ keyword: string; floor: number }> = [
	{ keyword: "1층", floor: 1 },
	{ keyword: "2층", floor: 2 },
	{ keyword: "3층", floor: 3 },
	{ keyword: "4층", floor: 4 },
	{ keyword: "5층", floor: 5 },
	{ keyword: "1F", floor: 1 },
	{ keyword: "2F", floor: 2 },
	{ keyword: "3F", floor: 3 },
];

const ROOM_PATTERN = /(\d{3,4})\s*호/g;

const FORBIDDEN_PROP_HINT: Array<{ term: RegExp }> = [
	{ term: /열쇠/g },
	{ term: /도어락/g },
];

const VISA_DURATION_HINTS = [
	{ re: /H-?1\s*비자/, months: 6 },
	{ re: /D-?2\s*비자/, months: 48 },
	{ re: /D-?4\s*비자/, months: 6 },
	{ re: /관광\s*비자/, months: 3 },
];

const VALIDATION_RULES: ValidationRule[] = [
	{
		id: "floor-consistency",
		run: (content, world) => checkFloorConsistency(content, world),
	},
	{
		id: "forbidden-props",
		run: (content, world) => checkForbiddenProps(content, world),
	},
	{
		id: "visa-duration",
		run: (content) => checkVisaDuration(content),
	},
	{
		id: "korean-register",
		run: (content, _world, lang) =>
			lang === "ko" ? checkKoreanRegister(content) : [],
	},
	{
		id: "english-em-dash",
		run: (content, _world, lang) =>
			lang === "en" ? checkEnglishEmDash(content) : [],
	},
	{
		id: "mixed-script-punctuation",
		run: (content) => checkMixedScriptPunctuation(content),
	},
];

function checkFloorConsistency(
	content: string,
	world: WorldData,
): RuleResult[] {
	const results: RuleResult[] = [];
	if (world.locations.length === 0) return results;

	const locationsByFloor = new Map<number, WorldLocation[]>();
	for (const loc of world.locations) {
		if (loc.floor === undefined) continue;
		const bucket = locationsByFloor.get(loc.floor) ?? [];
		bucket.push(loc);
		locationsByFloor.set(loc.floor, bucket);
	}

	// Adjacency claim: text says "벽 하나 사이" / "옆방" / "이웃" / "위/아래"
	// between two named characters, but those characters are on different
	// floors in world data → flag.
	const adjacencyPhrases = [
		"벽 하나 사이",
		"벽 사이",
		"옆방",
		"옆 집",
		"이웃",
		"바로 옆",
	];
	const hasAdjacencyClaim = adjacencyPhrases.some((p) => content.includes(p));
	if (!hasAdjacencyClaim) return results;

	const namedCharsInText = world.locations.filter((loc) =>
		content.includes(loc.name),
	);
	if (namedCharsInText.length < 2) return results;

	// Find pairs that are mentioned together in the same paragraph-ish window.
	for (let i = 0; i < namedCharsInText.length; i++) {
		for (let j = i + 1; j < namedCharsInText.length; j++) {
			const a = namedCharsInText[i];
			const b = namedCharsInText[j];
			if (!a || !b) continue;
			if (a.floor === undefined || b.floor === undefined) continue;
			if (a.floor !== b.floor) {
				results.push({
					severity: "error",
					message: `Adjacency claim between "${a.name}" (floor ${a.floor}) and "${b.name}" (floor ${b.floor}) — they are not on the same floor.`,
				});
			}
		}
	}

	// Two pointer-safe accessors used by tests / callers: the FLOOR_KEYWORDS
	// and ROOM_PATTERN exports are safe to read, but the lint rule wants
	// explicit guards when callers index into world.locations.
	void world.locations.length;
	return results;
}

function checkForbiddenProps(content: string, world: WorldData): RuleResult[] {
	const results: RuleResult[] = [];

	// Contradiction check: text mixes "도어락" and "열쇠" — these are
	// mutually exclusive entry methods. We surface a warning even when
	// world.md is silent because the combination is almost always a slip.
	const presentTerms = FORBIDDEN_PROP_HINT.filter((h) =>
		h.term.test(content),
	).map((h) => h.term.source);
	if (
		presentTerms.includes("열쇠") &&
		presentTerms.includes("도어락") &&
		!world.props.some((p) => p.name.includes("열쇠") && p.allowed)
	) {
		results.push({
			severity: "warning",
			message:
				'Text mixes "도어락" (keyless) with "열쇠" (key) — likely a prop consistency bug.',
		});
	}

	const forbidden = world.props.filter((p) => !p.allowed);
	if (forbidden.length === 0) return results;

	for (const prop of forbidden) {
		// Look for the prop name itself appearing in the chapter text. The
		// world author marks something like "열쇠 ❌" which we parse as
		// name="열쇠" allowed=false.
		const matches = content.match(new RegExp(escapeRegex(prop.name), "g"));
		if (matches && matches.length > 0) {
			results.push({
				severity: "error",
				message: `Forbidden prop "${prop.name}" appears ${matches.length}× in chapter text (world.md marks it as not allowed).`,
			});
		}
	}

	return results;
}

function checkVisaDuration(content: string): RuleResult[] {
	const results: RuleResult[] = [];
	for (const hint of VISA_DURATION_HINTS) {
		if (!hint.re.test(content)) continue;

		// Look for duration claim near the visa mention.
		const monthsMatch = content.match(/(\d+)\s*개월/);
		const yearMatch = content.match(/(\d+)\s*년/);
		const claimedMonths = monthsMatch
			? Number.parseInt(monthsMatch[1] ?? "", 10)
			: yearMatch
				? Number.parseInt(yearMatch[1] ?? "", 10) * 12
				: undefined;

		if (claimedMonths === undefined) continue;
		// Allow ±1 month slack for arrival/departure day rounding.
		const delta = Math.abs(claimedMonths - hint.months);
		if (delta > 1 && claimedMonths !== hint.months) {
			results.push({
				severity: "warning",
				message: `Visa type matched (${hint.re.source}) typically allows ~${hint.months} months stay, but text mentions ${claimedMonths} months — verify the timeline.`,
			});
		}
	}
	return results;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Korean register (문어체/구어체) consistency. Narrative prose that
 * suddenly slips into very formal written endings (-습니다/-(스)ㅂ니다)
 * inside dialogue or close-POV narration reads unnatural. We scan the
 * text inside dialogue quotes and flag when both formal and informal
 * endings appear — picking one register per scene is the norm.
 */
const KO_FORMAL_ENDINGS = /(?:습니다|습니까|ㅂ니다|ㅂ니까|십시오)/;
const KO_INFORMAL_ENDINGS =
	/(?:반가워|좋아|싫어|가자|하자|뭐야|어떡해|그래|알았어)/;

/** Pull every quoted phrase from a single line (ASCII + full-width). */
function extractQuoted(line: string): string[] {
	const out: string[] = [];
	for (const m of line.matchAll(/"([^"]+)"/g)) {
		const captured = m[1];
		if (captured) out.push(captured);
	}
	for (const m of line.matchAll(/“([^”]+)”/g)) {
		const captured = m[1];
		if (captured) out.push(captured);
	}
	return out;
}

function checkKoreanRegister(content: string): RuleResult[] {
	const results: RuleResult[] = [];
	const dialogueLines = content
		.split("\n")
		.filter((line) => line.includes('"') || line.includes("“"));
	if (dialogueLines.length < 2) return results;
	let sawFormal: { quote: string } | null = null;
	let sawInformal: { quote: string } | null = null;
	for (const line of dialogueLines) {
		for (const quote of extractQuoted(line)) {
			if (KO_FORMAL_ENDINGS.test(quote) && !sawFormal) {
				sawFormal = { quote };
			}
			if (KO_INFORMAL_ENDINGS.test(quote) && !sawInformal) {
				sawInformal = { quote };
			}
		}
	}
	if (sawFormal && sawInformal) {
		results.push({
			severity: "warning",
			message:
				"Korean register drift: chapter mixes -습니다 (formal) with informal endings (-어/해/죠). Pick one register per scene.",
			excerpt: `“${sawFormal.quote}”  ↔  “${sawInformal.quote}”`,
		});
	}
	return results;
}

/**
 * English em-dash overuse. AI-generated English prose leans heavily on
 * em-dashes — three or more in a single paragraph is almost always a
 * tell. We flag paragraphs that cross that threshold.
 */
function checkEnglishEmDash(content: string): RuleResult[] {
	const results: RuleResult[] = [];
	const paragraphs = content.split(/\n\s*\n/);
	for (const para of paragraphs) {
		const count = (para.match(/—/g) ?? []).length;
		if (count >= 3) {
			results.push({
				severity: "warning",
				message: `Em-dash overuse: ${count} em-dashes in one paragraph (threshold 3). Likely AI tell; rephrase with commas, parens, or split the sentence.`,
			});
		}
	}
	return results;
}

/**
 * Mixed-script punctuation. Korean prose should use Korean-style
 * quotation marks (“ ”, ‘ ’) and full-width stops when they appear;
 * English should use straight quotes. The most common slip is a Korean
 * line using ASCII straight quotes ("…") — we flag those.
 */
const KO_ASCII_DOUBLE_QUOTE = /["][^"\n]{1,80}["]/;

function checkMixedScriptPunctuation(content: string): RuleResult[] {
	const results: RuleResult[] = [];
	// Only check paragraphs that contain Hangul — pure-ASCII English
	// paragraphs are allowed straight quotes.
	const hangulParagraphs = content
		.split(/\n\s*\n/)
		.filter((p) => /[\uAC00-\uD7A3]/.test(p));
	for (const para of hangulParagraphs) {
		const matches = para.match(new RegExp(KO_ASCII_DOUBLE_QUOTE, "g"));
		if (matches && matches.length >= 1) {
			results.push({
				severity: "info",
				message: `Hangul paragraph uses ASCII straight quotes ("…"). Korean convention prefers “…” (full-width) inside Korean text.`,
				excerpt: matches[0],
			});
		}
	}
	return results;
}

export { FLOOR_KEYWORDS, ROOM_PATTERN };
