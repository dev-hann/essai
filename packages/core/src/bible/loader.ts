import { promises as fs } from "node:fs";
import path from "node:path";
import {
	parseChapters,
	parseCharacters,
	parseEmotion,
	parseList,
	parseRelationships,
} from "./parser.js";
import type { BibleData } from "./types.js";

const KNOWN_FILES = {
	"characters.md": "characters",
	"relationships.md": "relationships",
	"emotion.md": "emotion",
	"chapters.md": "chapters",
	"style.md": "style",
	"tone.md": "tone",
	"constraints.md": "constraints",
} as const;

function emptyBible(): BibleData {
	return {
		characters: {},
		relationships: [],
		emotion: [],
		chapters: new Map(),
		style: [],
		tone: [],
		constraints: [],
		additionalContext: {},
	};
}

export async function loadBible(bibleDir: string): Promise<BibleData> {
	const bible = emptyBible();

	let entries: string[];
	try {
		entries = await fs.readdir(bibleDir);
	} catch {
		return bible;
	}

	const markdownFiles = entries
		.filter((name) => name.endsWith(".md"))
		.sort();

	for (const fileName of markdownFiles) {
		const filePath = path.join(bibleDir, fileName);
		const content = await fs.readFile(filePath, "utf-8");
		const known = (KNOWN_FILES as Record<string, string>)[fileName];

		switch (known) {
			case "characters":
				bible.characters = parseCharacters(content);
				break;
			case "relationships":
				bible.relationships = parseRelationships(content);
				break;
			case "emotion":
				bible.emotion = parseEmotion(content);
				break;
			case "chapters":
				bible.chapters = parseChapters(content);
				break;
			case "style":
				bible.style = parseList(content);
				break;
			case "tone":
				bible.tone = parseList(content);
				break;
			case "constraints":
				bible.constraints = parseList(content);
				break;
			default: {
				const stem = fileName.slice(0, -".md".length);
				bible.additionalContext[stem] = content;
			}
		}
	}

	return bible;
}
