import type { BibleData, ChapterPlan } from "../bible/types.js";
import type { MemoryEntry } from "../memory/types.js";
import { buildSystemPrompt } from "./craft-rules.js";

export interface WriterPromptOptions {
	bible: BibleData;
	chapterNumber: number;
	memory?: MemoryEntry[];
	language: string;
	chapterWords: number;
	instruction?: string;
}

export interface WriterPrompt {
	system: string;
	user: string;
}

function formatCharacters(bible: BibleData): string {
	const entries = Object.entries(bible.characters);
	if (entries.length === 0) return "";
	const lines = entries.map(([name, fields]) => {
		const fieldStr = Object.entries(fields)
			.map(([k, v]) => `${k} ${v}`)
			.join(", ");
		return `- ${name}: ${fieldStr}`;
	});
	return `### Characters\n${lines.join("\n")}`;
}

function formatRelationships(bible: BibleData): string {
	if (bible.relationships.length === 0) return "";
	const lines = bible.relationships.map(
		(r) => `- ${r.from} → ${r.to}: ${r.description}`,
	);
	return `### Relationships\n${lines.join("\n")}`;
}

function formatEmotion(bible: BibleData): string {
	if (bible.emotion.length === 0) return "";
	const lines = bible.emotion.map((stage) => {
		const emos = Object.entries(stage.emotions)
			.map(([char, emo]) => `${char}=${emo}`)
			.join(", ");
		return `- Stage ${stage.stage} "${stage.name}" (${stage.chapters}): ${emos}`;
	});
	return `### Emotion Curve\n${lines.join("\n")}`;
}

function formatAdditionalContext(bible: BibleData): string {
	const entries = Object.entries(bible.additionalContext);
	if (entries.length === 0) return "";
	const blocks = entries.map(
		([stem, content]) => `### Additional Context: ${stem}\n${content}`,
	);
	return blocks.join("\n\n");
}

function formatChapterPlan(plan: ChapterPlan): string {
	const scenes = plan.scenes.length
		? plan.scenes.map((s) => `- ${s}`).join("\n")
		: "- (no scenes specified)";
	return `## Chapter ${plan.number} Plan\nTitle: ${plan.title}\n\nScenes:\n${scenes}`;
}

function formatMemory(memory: MemoryEntry[]): string {
	if (memory.length === 0) return "";
	const blocks = memory.map((entry) => {
		const events = entry.events.map((e) => `  - ${e}`).join("\n");
		const emotions = entry.emotions
			.map((e) => `  - ${e.character}: ${e.emotion} (${e.intensity})`)
			.join("\n");
		const foreshadowing = entry.foreshadowing
			.map((f) => `  - ${f.item} (${f.status})`)
			.join("\n");
		const facts = entry.facts.map((f) => `  - ${f}`).join("\n");
		return [
			`### ${entry.chapter}화: ${entry.title}`,
			events ? `Events:\n${events}` : "",
			emotions ? `Emotions:\n${emotions}` : "",
			foreshadowing ? `Foreshadowing:\n${foreshadowing}` : "",
			facts ? `Facts:\n${facts}` : "",
		]
			.filter(Boolean)
			.join("\n\n");
	});
	return `## Previous Story\n${blocks.join("\n\n")}`;
}

export function buildWriterPrompt(opts: WriterPromptOptions): WriterPrompt {
	const { bible, chapterNumber, memory, language, chapterWords, instruction } =
		opts;

	const system = buildSystemPrompt({
		language,
		style: bible.style,
		tone: bible.tone,
		constraints: bible.constraints,
	});

	const setupParts = [
		formatCharacters(bible),
		formatRelationships(bible),
		formatEmotion(bible),
		formatAdditionalContext(bible),
	].filter(Boolean);

	const userParts: string[] = [];

	if (setupParts.length > 0) {
		userParts.push(`## Setup\n${setupParts.join("\n\n")}`);
	}

	const memorySection = memory ? formatMemory(memory) : "";
	if (memorySection) userParts.push(memorySection);

	const plan = bible.chapters.get(chapterNumber);
	if (plan) userParts.push(formatChapterPlan(plan));

	const instructionLines = [
		`Target length: approximately ${chapterWords} characters.`,
		`Output language: ${language}.`,
	];
	if (instruction)
		instructionLines.push(`Additional instruction: ${instruction}`);
	userParts.push(`## Instruction\n${instructionLines.join("\n")}`);

	return { system, user: userParts.join("\n\n") };
}
