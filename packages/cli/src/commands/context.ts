import path from "node:path";
import {
	type BibleData,
	type ChapterMemory,
	type CharacterState,
	loadBible,
	type MemoryForeshadowing,
	MemoryStore,
} from "@essai/core";
import { type IoOpts, resolveStdout } from "./_shared.js";

const MEMORY_DIR = "memory";
const DEFAULT_RECENT_COUNT = 3;
const CHARS_PER_TOKEN = 4;
const OPEN_FORESHADOW_STATUSES = new Set(["unresolved", "active"]);

export interface ContextOptions extends IoOpts {
	recentCount?: number;
}

export interface ContextPreview {
	chapter: number;
	bible: BibleData;
	recentSummaries: ChapterMemory[];
	unresolvedForeshadowing: MemoryForeshadowing[];
	characterState: Record<string, CharacterState>;
	estimatedTokens: number;
}

function collectOpenForeshadowing(
	memories: ChapterMemory[],
): MemoryForeshadowing[] {
	const seen = new Set<string>();
	const collected: MemoryForeshadowing[] = [];
	for (const memory of memories) {
		for (const item of memory.foreshadowing) {
			if (!OPEN_FORESHADOW_STATUSES.has(item.status)) continue;
			const key = `${item.chapterIntroduced}:${item.item}`;
			if (seen.has(key)) continue;
			seen.add(key);
			collected.push(item);
		}
	}
	return collected;
}

function mergeCharacterState(
	memories: ChapterMemory[],
): Record<string, CharacterState> {
	const merged: Record<string, CharacterState> = {};
	for (const memory of memories) {
		for (const [name, state] of Object.entries(memory.characterState)) {
			merged[name] = state;
		}
	}
	return merged;
}

function estimateTokens(
	memories: ChapterMemory[],
	openForeshadowing: MemoryForeshadowing[],
	characterState: Record<string, CharacterState>,
): number {
	let chars = 0;
	for (const memory of memories) {
		chars += memory.title.length;
		chars += memory.events.join("").length;
		chars += memory.facts.join("").length;
		for (const emotion of memory.emotions) {
			chars += emotion.character.length + emotion.emotion.length;
		}
	}
	for (const foreshadowing of openForeshadowing) {
		chars += foreshadowing.item.length;
	}
	for (const state of Object.values(characterState)) {
		chars += state.location.length + state.mood.length;
		chars += state.knows.join("").length;
	}
	return Math.ceil(chars / CHARS_PER_TOKEN);
}

export async function buildContextPreview(
	chapter: number,
	opts: ContextOptions = {},
): Promise<ContextPreview> {
	const cwd = opts.cwd ?? process.cwd();
	const recentCount = opts.recentCount ?? DEFAULT_RECENT_COUNT;

	const [bible, recentSummaries] = await Promise.all([
		loadBible(path.join(cwd, "bible")),
		new MemoryStore().loadRecent(path.join(cwd, MEMORY_DIR), recentCount),
	]);

	const unresolvedForeshadowing = collectOpenForeshadowing(recentSummaries);
	const characterState = mergeCharacterState(recentSummaries);
	const estimatedTokens = estimateTokens(
		recentSummaries,
		unresolvedForeshadowing,
		characterState,
	);

	return {
		chapter,
		bible,
		recentSummaries,
		unresolvedForeshadowing,
		characterState,
		estimatedTokens,
	};
}

export async function contextCommand(
	chapter: number,
	opts: ContextOptions = {},
): Promise<void> {
	const stdout = resolveStdout(opts);
	const preview = await buildContextPreview(chapter, opts);

	stdout.write(`Context preview for Chapter ${preview.chapter}\n`);
	stdout.write(`\n`);

	const plan = preview.bible.chapters.get(chapter);
	if (plan) {
		stdout.write(`Plan: ${plan.title}\n`);
	} else {
		stdout.write(
			`Plan: (no chapter ${chapter} plan found in bible/chapters.md)\n`,
		);
	}

	stdout.write(`\n`);
	stdout.write(`Recent memories: ${preview.recentSummaries.length}\n`);
	for (const memory of preview.recentSummaries) {
		stdout.write(
			`  - Chapter ${memory.chapter}: ${memory.title} (${memory.events.length} events)\n`,
		);
	}

	stdout.write(`\n`);
	if (preview.unresolvedForeshadowing.length === 0) {
		stdout.write(`Unresolved foreshadowing: none\n`);
	} else {
		stdout.write(
			`Unresolved foreshadowing: ${preview.unresolvedForeshadowing.length}\n`,
		);
		for (const foreshadowing of preview.unresolvedForeshadowing) {
			stdout.write(
				`  - ${foreshadowing.item} (introduced chapter ${foreshadowing.chapterIntroduced}, ${foreshadowing.status})\n`,
			);
		}
	}

	stdout.write(`\n`);
	const stateNames = Object.keys(preview.characterState);
	if (stateNames.length === 0) {
		stdout.write(`Character state: none\n`);
	} else {
		stdout.write(`Character state:\n`);
		for (const [name, state] of Object.entries(preview.characterState)) {
			stdout.write(
				`  - ${name}: ${state.location} / ${state.mood} (knows ${state.knows.length})\n`,
			);
		}
	}

	stdout.write(`\n`);
	stdout.write(`Estimated injected tokens: ~${preview.estimatedTokens}\n`);

	if (
		preview.recentSummaries.length === 0 &&
		preview.unresolvedForeshadowing.length === 0
	) {
		stdout.write(
			`(no memory yet — chapter ${chapter} will be written from bible alone)\n`,
		);
	}
}
