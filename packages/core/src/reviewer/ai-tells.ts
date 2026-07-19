/**
 * AI tells detection — checks for AI characteristic words/phrases.
 * No LLM call needed, pure string matching.
 */

const AI_TELLS_EN = [
	"delve",
	"tapestry",
	"testament",
	"intricate",
	"pivotal",
	"nuanced",
	"resonance",
	"symphony",
	"indelible",
	"poignant",
	"labyrinth",
	"mosaic",
	"corridor",
	"eloquent",
];

const AI_TELLS_KO = [
	"깊이 있는",
	"피어나",
	"울렸다",
	"여운이",
	"핵심적인",
	"결국에는",
	"이것은 ~이자",
	"비할 데 없는",
	"지워지지 않는",
];

const AI_PATTERNS = [
	/it wasn't .+; it was .+/i,
	/It's not just .+; it's .+/i,
	/단순한 .+이자 .+이다/,
];

export interface AITellResult {
	found: string[];
	count: number;
}

export function detectAITells(content: string): AITellResult {
	const found: string[] = [];

	const lower = content.toLowerCase();
	for (const word of AI_TELLS_EN) {
		if (lower.includes(word)) {
			found.push(word);
		}
	}

	for (const word of AI_TELLS_KO) {
		if (content.includes(word)) {
			found.push(word);
		}
	}

	for (const pattern of AI_PATTERNS) {
		if (pattern.test(content)) {
			found.push(pattern.source);
		}
	}

	return { found, count: found.length };
}
