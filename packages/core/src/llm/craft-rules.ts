export interface SystemPromptOptions {
	language: string;
	style?: string[];
	tone?: string[];
	constraints?: string[];
}

export const CRAFT_RULES: readonly string[] = [
	"Show, don't tell — render emotion and meaning through action, sense, and detail rather than summary labels.",
	"Simile restraint: use at most one simile or metaphor per scene.",
	"Anti-AI wording: avoid the words delve, tapestry, testament, intricate, pivotal, and other AI-tell vocabulary.",
	"No padding: every scene must advance something (plot, character, or theme).",
	"Climax is a scene, not a recap — play it out in the present, never summarize it.",
	"Payoffs need setup — do not resolve something the reader has never seen planted.",
	"Side characters need motives — no one acts only to serve the protagonist.",
	"Mobile-first pacing — short paragraphs, frequent paragraph breaks, hooks that pull the reader forward.",
	"Bible compliance — only use settings, characters, and facts defined in the Bible; invent nothing new.",
];

export function buildLanguageDirective(language: string): string {
	return `Write all prose, dialogue, and narration in ${language}.`;
}

function section(
	heading: string,
	lines: readonly string[] | undefined,
): string {
	if (!lines || lines.length === 0) return "";
	const body = lines.map((line) => `- ${line}`).join("\n");
	return `## ${heading}\n${body}`;
}

export function buildSystemPrompt(opts: SystemPromptOptions): string {
	const parts: string[] = [];

	parts.push(
		"You are the writing engine for an Essai project. Follow every rule below without exception.",
	);

	parts.push("## Craft Rules");
	parts.push(CRAFT_RULES.map((rule) => `- ${rule}`).join("\n"));

	parts.push("## Language");
	parts.push(buildLanguageDirective(opts.language));

	const style = section("Writing Style", opts.style);
	if (style) parts.push(style);

	const tone = section("Tone & Mood", opts.tone);
	if (tone) parts.push(tone);

	const constraints = section("Constraints", opts.constraints);
	if (constraints) parts.push(constraints);

	return parts.join("\n\n");
}
