import { describe, expect, it } from "vitest";
import {
	buildLanguageDirective,
	buildSystemPrompt,
	CRAFT_RULES,
} from "./craft-rules.js";

describe("CRAFT_RULES", () => {
	it("includes the nine craft rules from the design doc", () => {
		const joined = CRAFT_RULES.join("\n");

		expect(joined).toMatch(/show,? don't tell/i);
		expect(joined).toMatch(/simile/i);
		expect(joined.toLowerCase()).toContain("delve");
		expect(joined).toMatch(/no padding/i);
		expect(joined).toMatch(/climax is a scene/i);
		expect(joined).toMatch(/payoffs? need setup/i);
		expect(joined).toMatch(/side characters? need/i);
		expect(joined).toMatch(/mobile-first/i);
		expect(joined).toMatch(/bible compliance/i);
	});

	it("is a non-empty array of strings", () => {
		expect(Array.isArray(CRAFT_RULES)).toBe(true);
		expect(CRAFT_RULES.length).toBeGreaterThanOrEqual(9);
		for (const rule of CRAFT_RULES) {
			expect(typeof rule).toBe("string");
			expect(rule.length).toBeGreaterThan(0);
		}
	});
});

describe("buildLanguageDirective", () => {
	it("returns the directive naming the target language", () => {
		expect(buildLanguageDirective("ko")).toBe(
			"Write all prose, dialogue, and narration in ko.",
		);
	});

	it("reflects the language token verbatim without any language allow-list", () => {
		expect(buildLanguageDirective("zh-TW")).toBe(
			"Write all prose, dialogue, and narration in zh-TW.",
		);
	});
});

describe("buildSystemPrompt", () => {
	it("embeds the language directive", () => {
		const prompt = buildSystemPrompt({ language: "ko" });

		expect(prompt).toContain("Write all prose, dialogue, and narration in ko.");
	});

	it("includes every craft rule", () => {
		const prompt = buildSystemPrompt({ language: "en" });

		for (const rule of CRAFT_RULES) {
			expect(prompt).toContain(rule);
		}
	});

	it("includes a style section when style rules are provided", () => {
		const prompt = buildSystemPrompt({
			language: "en",
			style: ["Use colloquial Korean.", "Keep sentences short."],
		});

		expect(prompt).toContain("Use colloquial Korean.");
		expect(prompt).toContain("Keep sentences short.");
	});

	it("includes a tone section when tone rules are provided", () => {
		const prompt = buildSystemPrompt({
			language: "en",
			tone: ["Gentle and quiet.", "Occasionally humorous."],
		});

		expect(prompt).toContain("Gentle and quiet.");
		expect(prompt).toContain("Occasionally humorous.");
	});

	it("includes a constraints section when constraints are provided", () => {
		const prompt = buildSystemPrompt({
			language: "en",
			constraints: ["No explicit violence.", "No new characters."],
		});

		expect(prompt).toContain("No explicit violence.");
		expect(prompt).toContain("No new characters.");
	});

	it("omits empty optional sections cleanly", () => {
		const prompt = buildSystemPrompt({ language: "en" });

		expect(prompt).not.toContain("undefined");
		expect(prompt.trim().length).toBeGreaterThan(0);
	});

	it("matches the recorded snapshot for language-only prompt", () => {
		expect(buildSystemPrompt({ language: "ko" })).toMatchInlineSnapshot(`
			"You are the writing engine for an Essai project. Follow every rule below without exception.

			## Craft Rules

			- Show, don't tell — render emotion and meaning through action, sense, and detail rather than summary labels.
			- Simile restraint: use at most one simile or metaphor per scene.
			- Anti-AI wording: avoid the words delve, tapestry, testament, intricate, pivotal, and other AI-tell vocabulary.
			- No padding: every scene must advance something (plot, character, or theme).
			- Climax is a scene, not a recap — play it out in the present, never summarize it.
			- Payoffs need setup — do not resolve something the reader has never seen planted.
			- Side characters need motives — no one acts only to serve the protagonist.
			- Mobile-first pacing — short paragraphs, frequent paragraph breaks, hooks that pull the reader forward.
			- Bible compliance — only use settings, characters, and facts defined in the Bible; invent nothing new.

			## Language

			Write all prose, dialogue, and narration in ko."
		`);
	});

	it("matches the recorded snapshot when style, tone, and constraints are set", () => {
		expect(
			buildSystemPrompt({
				language: "en",
				style: ["Use colloquial dialogue.", "Keep paragraphs short."],
				tone: ["Gentle and quiet."],
				constraints: ["No new characters.", "No explicit violence."],
			}),
		).toMatchInlineSnapshot(`
			"You are the writing engine for an Essai project. Follow every rule below without exception.

			## Craft Rules

			- Show, don't tell — render emotion and meaning through action, sense, and detail rather than summary labels.
			- Simile restraint: use at most one simile or metaphor per scene.
			- Anti-AI wording: avoid the words delve, tapestry, testament, intricate, pivotal, and other AI-tell vocabulary.
			- No padding: every scene must advance something (plot, character, or theme).
			- Climax is a scene, not a recap — play it out in the present, never summarize it.
			- Payoffs need setup — do not resolve something the reader has never seen planted.
			- Side characters need motives — no one acts only to serve the protagonist.
			- Mobile-first pacing — short paragraphs, frequent paragraph breaks, hooks that pull the reader forward.
			- Bible compliance — only use settings, characters, and facts defined in the Bible; invent nothing new.

			## Language

			Write all prose, dialogue, and narration in en.

			## Writing Style
			- Use colloquial dialogue.
			- Keep paragraphs short.

			## Tone & Mood
			- Gentle and quiet.

			## Constraints
			- No new characters.
			- No explicit violence."
		`);
	});
});
