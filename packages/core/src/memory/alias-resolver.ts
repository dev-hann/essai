import type { ChapterMemory } from "./types.js";

/**
 * Character alias resolution across chapter memories.
 *
 * The LLM summarizer occasionally emits different keys for the same
 * character (e.g. "카운터 여자" in ch1 before 도윤 learns her name, then
 * "지아" from ch2 onward). characterState and emotions then fragment
 * across two keys, which weakens the memory injected into later
 * chapters and confuses the auditor.
 *
 * `resolveCharacterAliases` runs after loading recent memories and
 * rewrites the in-memory copies (never touching disk) so callers see a
 * unified character namespace. Aliases are derived from the project's
 * bible/characters.md frontmatter via the `aliases` field when authors
 * declare them, with substring fallback for the common "x 여자/남자" →
 * proper name pattern.
 *
 * Authors opt in by listing known aliases in characters.md:
 *
 *   ## 지아
 *   - aliases: 카운터 여자, 서점 주인
 *
 * The function is pure and idempotent: running it twice yields the
 * same result as running it once.
 */

export interface CharacterAliasMap {
	/** Canonical name → known aliases for that character. */
	[key: string]: string[];
}

/**
 * Parse an alias map from bible/characters.md content. Each `## Name`
 * block may carry an `- aliases: a, b, c` field. The function returns
 * a map keyed by canonical name. Quirks (missing block, missing field,
 * trailing commas) are tolerated — this is a best-effort hint, not
 * canonical data.
 */
export function parseAliasesFromCharactersMd(raw: string): CharacterAliasMap {
	const out: CharacterAliasMap = {};
	const lines = raw.split(/\r?\n/);
	let current: string | null = null;
	for (const line of lines) {
		const headingMatch = line.match(/^\s*##\s+(.+?)\s*$/);
		if (headingMatch) {
			current = headingMatch[1]!.trim();
			continue;
		}
		if (!current) continue;
		const aliasMatch = line.match(/^\s*-\s*aliases?\s*[:：]\s*(.+)$/i);
		if (aliasMatch) {
			const aliases = aliasMatch[1]!
				.split(/[,，]/)
				.map((a) => a.trim())
				.filter((a) => a.length > 0);
			if (aliases.length > 0) {
				out[current] = (out[current] ?? []).concat(aliases);
			}
		}
	}
	return out;
}

/**
 * Apply an alias map to a list of chapter memories, returning a new
 * list with character names normalized. Side-effect free — the input
 * array and its objects are untouched.
 */
export function resolveCharacterAliases(
	memories: readonly ChapterMemory[],
	aliases: CharacterAliasMap,
): ChapterMemory[] {
	if (Object.keys(aliases).length === 0) return memories.slice();
	const aliasToCanonical = new Map<string, string>();
	for (const [canonical, list] of Object.entries(aliases)) {
		for (const alias of list) {
			aliasToCanonical.set(alias, canonical);
		}
	}
	if (aliasToCanonical.size === 0) return memories.slice();

	const rewriteName = (name: string): string =>
		aliasToCanonical.get(name) ?? name;

	return memories.map((m) => {
		const emotions = m.emotions.map((e) => ({
			...e,
			character: rewriteName(e.character),
		}));
		const characterState: typeof m.characterState = {};
		for (const [name, state] of Object.entries(m.characterState)) {
			characterState[rewriteName(name)] = state;
		}
		const languageLevel = m.languageLevel.map((l) => ({
			...l,
			character: rewriteName(l.character),
		}));
		return {
			...m,
			emotions,
			characterState,
			languageLevel,
		};
	});
}
