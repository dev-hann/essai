import { generateText } from "ai";
import type { BibleData } from "../bible/types.js";
import type { ProjectConfig } from "../config/project-config.js";
import { createModel } from "../llm/provider.js";
import type { ChapterMemory, LanguageLevel } from "../memory/types.js";
import type {
	ValidationFinding,
	ValidationSeverity,
} from "../validator/static-validator.js";
import type { WorldData } from "../validator/world-types.js";

/**
 * LLM-driven continuity auditor.
 *
 * The StaticValidator catches deterministic bugs (floor math, forbidden
 * props). The Auditor complements it with semantic checks that need a
 * model: character voice drift, emotion continuity, information barriers,
 * pacing, etc. Output is the same ValidationFinding shape so callers can
 * merge static + LLM findings uniformly.
 *
 * Per docs/validation-future-work.md we run a focused set of 8 dimensions
 * rather than the InkOS-style 37 — easier to interpret, lower token cost,
 * and the high-signal dimensions for contemporary romance/web-novel work
 * are well covered.
 */

export const AUDIT_DIMENSIONS = [
	{
		id: "character-consistency",
		label: "OOC (캐릭터 일관성)",
		prompt:
			"Do any characters act, speak, or decide in ways that contradict their established personality, speech style, or attachment pattern from the bible?",
	},
	{
		id: "timeline",
		label: "타임라인",
		prompt:
			"Are there temporal inconsistencies (jumps backward, impossible same-day events, season mismatches) versus prior chapters?",
	},
	{
		id: "setting-conflict",
		label: "설정 충돌 (공간/소품)",
		prompt:
			"Do locations, room layouts, distances, or props contradict what was previously established? Flag any 'suddenly the gun was on the table' setups.",
	},
	{
		id: "emotion-continuity",
		label: "감정선 연속성",
		prompt:
			"Do the emotional beats follow naturally from the previous chapter's feelings, or does a character's mood jump without cause?",
	},
	{
		id: "language-progression",
		label: "언어 발전",
		prompt:
			"If the story tracks a character's language ability (e.g. 외국인 한국어 학습자), does their speech level match the previously established progression?",
	},
	{
		id: "pacing",
		label: "페이싱",
		prompt:
			"Does the chapter advance at least one beat of the romance arc, or does it stall (recap, padding, no new information)?",
	},
	{
		id: "information-barrier",
		label: "정보 경계",
		prompt:
			"Does any character act on information they could not yet know (author leak)? Check that 'knows' lists in prior memory are respected.",
	},
	{
		id: "craft-rule-violations",
		label: "Craft rule 위반",
		prompt:
			"Beyond AI-tell words, are there show/tell violations, simile overload, or padding the craft rules forbid? Be concise.",
	},
] as const;

export type AuditDimensionId = (typeof AUDIT_DIMENSIONS)[number]["id"];

export interface AuditOptions {
	/**
	 * Restrict the audit to a subset of dimensions. Default: all 8.
	 */
	only?: AuditDimensionId[];
	/**
	 * Per-character language proficiency snapshot for the language-progression
	 * dimension. When omitted, the dimension still runs but with no baseline.
	 */
	languageBaseline?: LanguageLevel[];
}

interface AuditCallResult {
	severity: ValidationSeverity;
	message: string;
}

/**
 * Single audit dimension prompt → LLM call → parsed finding.
 *
 * The model is instructed to reply with a one-line JSON verdict so we can
 * fail soft on parse errors and still produce a usable finding list.
 */
export class ContinuityAuditor {
	constructor(private readonly config: ProjectConfig) {}

	async audit(
		chapter: number,
		content: string,
		bible: BibleData,
		memory: ChapterMemory[],
		world: WorldData,
		options: AuditOptions = {},
	): Promise<ValidationFinding[]> {
		const dimensions = (options.only ?? AUDIT_DIMENSIONS.map((d) => d.id)).map(
			(id) => AUDIT_DIMENSIONS.find((d) => d.id === id),
		);

		const findings: ValidationFinding[] = [];
		for (const dimension of dimensions) {
			if (!dimension) continue;
			const result = await this.runDimension(
				dimension,
				chapter,
				content,
				bible,
				memory,
				world,
				options,
			);
			if (result) {
				findings.push({
					severity: result.severity,
					rule: `audit:${dimension.id}`,
					message: result.message,
				});
			}
		}
		return findings;
	}

	private async runDimension(
		dimension: (typeof AUDIT_DIMENSIONS)[number],
		chapter: number,
		content: string,
		bible: BibleData,
		memory: ChapterMemory[],
		world: WorldData,
		options: AuditOptions,
	): Promise<AuditCallResult | null> {
		const system = [
			`You are the continuity auditor for an Essai writing project.`,
			`Audit dimension: ${dimension.label} (${dimension.id}).`,
			``,
			`## Task`,
			dimension.prompt,
			``,
			`## Output`,
			`Reply with ONLY a JSON object: {"severity": "error" | "warning" | "info" | "ok", "message": "one short sentence in the project language"}.`,
			`- "ok" means no issue found; the message should still explain briefly what you checked.`,
			`- Do not include the chapter text in your reply.`,
			`- Keep the message under 200 characters.`,
			`- Write the message in ${this.config.language}.`,
		].join("\n");

		const userContext = this.buildUserContext(
			chapter,
			content,
			bible,
			memory,
			world,
			options,
		);

		let result: { text: string };
		try {
			result = await generateText({
				model: createModel(this.config.llm),
				system,
				prompt: userContext,
				temperature: 0.2,
				maxOutputTokens: 400,
			});
		} catch (err) {
			return {
				severity: "info",
				message: `audit:${dimension.id} skipped (LLM error: ${err instanceof Error ? err.message : "unknown"})`,
			};
		}

		return this.parseVerdict(result.text, dimension.id);
	}

	private buildUserContext(
		chapter: number,
		content: string,
		bible: BibleData,
		memory: ChapterMemory[],
		world: WorldData,
		options: AuditOptions,
	): string {
		const sections: string[] = [];
		sections.push(`## Chapter ${chapter} content\n${content}`);

		const recent = memory.slice(-3);
		if (recent.length > 0) {
			sections.push(
				`## Recent memory (last ${recent.length} chapter(s))\n${this.formatMemory(recent)}`,
			);
		}

		const bibleExcerpt = this.formatBible(bible);
		if (bibleExcerpt) {
			sections.push(`## Bible\n${bibleExcerpt}`);
		}

		const worldExcerpt = this.formatWorld(world);
		if (worldExcerpt) {
			sections.push(`## World\n${worldExcerpt}`);
		}

		if (options.languageBaseline && options.languageBaseline.length > 0) {
			sections.push(
				`## Language baseline\n${options.languageBaseline
					.map(
						(l) =>
							`- ${l.character}: ${l.level}${l.note ? ` (${l.note})` : ""}`,
					)
					.join("\n")}`,
			);
		}

		return sections.join("\n\n");
	}

	private formatMemory(memory: ChapterMemory[]): string {
		return memory
			.map((m) => {
				const lines = [
					`### Ch${m.chapter} — ${m.title} (${m.wordCount} chars)`,
					`events: ${m.events.join("; ")}`,
				];
				if (m.emotions.length > 0) {
					lines.push(
						`emotions: ${m.emotions
							.map((e) => `${e.character}=${e.emotion}(${e.intensity})`)
							.join("; ")}`,
					);
				}
				if (m.characterState) {
					const states = Object.entries(m.characterState).map(
						([name, s]) =>
							`${name}@${s.location} mood=${s.mood} knows=${s.knows.length}`,
					);
					if (states.length > 0) lines.push(`state: ${states.join("; ")}`);
				}
				if (m.propsIntroduced.length > 0) {
					lines.push(`props new: ${m.propsIntroduced.join(", ")}`);
				}
				return lines.join("\n");
			})
			.join("\n\n");
	}

	private formatBible(bible: BibleData): string {
		const parts: string[] = [];
		const characters = Object.entries(bible.characters)
			.map(([name, fields]) => {
				const f = fields as Record<string, string>;
				return `- ${name}: ${Object.entries(f)
					.map(([k, v]) => `${k}=${v}`)
					.join(", ")}`;
			})
			.join("\n");
		if (characters) parts.push(`### Characters\n${characters}`);
		if (bible.style.length > 0)
			parts.push(`### Style\n${bible.style.join("\n")}`);
		if (bible.tone.length > 0) parts.push(`### Tone\n${bible.tone.join("\n")}`);
		if (bible.constraints.length > 0)
			parts.push(`### Constraints\n${bible.constraints.join("\n")}`);
		return parts.join("\n\n");
	}

	private formatWorld(world: WorldData): string {
		const parts: string[] = [];
		if (world.locations.length > 0) {
			parts.push(
				`### Locations\n${world.locations
					.map(
						(l) =>
							`- ${l.name}${l.floor !== undefined ? ` (${l.floor}층)` : ""}${l.room !== undefined ? ` ${l.room}호` : ""}`,
					)
					.join("\n")}`,
			);
		}
		if (world.props.length > 0) {
			parts.push(
				`### Props\n${world.props
					.map((p) => `- ${p.name}: ${p.allowed ? "allowed" : "forbidden"}`)
					.join("\n")}`,
			);
		}
		if (world.timeline.length > 0) {
			parts.push(
				`### Timeline\n${world.timeline
					.map(
						(t) =>
							`- ${t.label}${t.start ? ` from ${t.start}` : ""}${t.end ? ` to ${t.end}` : ""}${t.durationMonths !== undefined ? ` (${t.durationMonths}mo)` : ""}`,
					)
					.join("\n")}`,
			);
		}
		return parts.join("\n\n");
	}

	private parseVerdict(
		text: string,
		dimensionId: string,
	): AuditCallResult | null {
		const trimmed = text.trim();
		// Strip ```json fences if the model wrapped the reply.
		const withoutFence = trimmed.startsWith("```")
			? trimmed
					.replace(/^```[a-z]*\n?/, "")
					.replace(/```$/, "")
					.trim()
			: trimmed;
		try {
			const parsed = JSON.parse(withoutFence) as {
				severity?: string;
				message?: string;
			};
			const severity = this.normalizeSeverity(parsed.severity);
			const message =
				typeof parsed.message === "string" && parsed.message.length > 0
					? parsed.message
					: `audit:${dimensionId} returned no message`;
			// "ok" verdicts are surfaced as info so the caller can filter.
			if (parsed.severity === "ok") {
				return { severity: "info", message };
			}
			return { severity, message };
		} catch {
			return {
				severity: "info",
				message: `audit:${dimensionId} returned non-JSON verdict: ${trimmed.slice(0, 120)}`,
			};
		}
	}

	private normalizeSeverity(value: unknown): ValidationSeverity {
		if (value === "error" || value === "warning" || value === "info") {
			return value;
		}
		// Unknown / "ok" / anything else defaults to info.
		return "info";
	}
}
