import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProjectConfig } from "@essai/core";
import type { LanguageModel } from "ai";
import { generateText, tool } from "ai";
import { z } from "zod";

export interface AgentMessage {
	role: "user" | "assistant";
	content: string;
}

export interface AgentSaveEvent {
	file: string;
	summary: string;
}

export interface AgentTurnResult {
	text: string;
	saves: AgentSaveEvent[];
	finished: boolean;
	history: AgentMessage[];
}

interface AgentRunOptions {
	model: LanguageModel;
	config: ProjectConfig;
	projectDir: string;
	history: AgentMessage[];
	userMessage: string | null;
	onMessage?: (text: string) => Promise<void>;
	onSaved?: (event: AgentSaveEvent) => Promise<void>;
}

const MAX_STEPS_PER_TURN = 5;

export async function runBibleAgentTurn(
	opts: AgentRunOptions,
): Promise<AgentTurnResult> {
	const {
		model,
		config,
		projectDir,
		history,
		userMessage,
		onMessage,
		onSaved,
	} = opts;

	const bibleDir = path.join(projectDir, "bible");
	await fs.mkdir(bibleDir, { recursive: true });

	const system = [
		"You are a story development agent. Have a natural conversation with the author to flesh out their story bible.",
		"Ask ONE question at a time. Listen to answers and ask contextual follow-ups.",
		"Use tools to save information as you learn it.",
		"Cover: characters, relationships, emotion arc, chapter plans, writing style, tone, constraints.",
		`Respond in ${config.language}.`,
		"When the author says they're done or all sections are covered, call finish.",
	].join("\n");

	const messages: AgentMessage[] = [...history];
	if (userMessage !== null) {
		messages.push({ role: "user", content: userMessage });
	} else if (messages.length === 0) {
		messages.push({
			role: "user",
			content: "안녕하세요. 새로운 이야기를 만들고 싶습니다. 도와주세요.",
		});
	}

	const appendToFile = async (
		filename: string,
		content: string,
	): Promise<void> => {
		const filePath = path.join(bibleDir, filename);
		let existing = "";
		try {
			existing = await fs.readFile(filePath, "utf-8");
		} catch {
			// empty file
		}
		await fs.writeFile(filePath, existing + content, "utf-8");
	};

	const saves: AgentSaveEvent[] = [];
	let finished = false;

	const tools = {
		saveCharacter: tool({
			description: "Save a character to bible/characters.md",
			inputSchema: z.object({
				name: z.string(),
				details: z.string().describe("Full character description"),
			}),
			execute: async (input: { name: string; details: string }) => {
				await appendToFile(
					"characters.md",
					`\n## ${input.name}\n${input.details}\n`,
				);
				const evt = {
					file: "characters.md",
					summary: `${input.name} 저장`,
				};
				saves.push(evt);
				await onSaved?.(evt);
				return `Saved character: ${input.name}`;
			},
		}),
		saveRelationship: tool({
			description: "Save a relationship to bible/relationships.md",
			inputSchema: z.object({
				from: z.string(),
				to: z.string(),
				description: z.string(),
			}),
			execute: async (input: {
				from: string;
				to: string;
				description: string;
			}) => {
				await appendToFile(
					"relationships.md",
					`${input.from} → ${input.to}: ${input.description}\n`,
				);
				const evt = {
					file: "relationships.md",
					summary: `${input.from} → ${input.to} 저장`,
				};
				saves.push(evt);
				await onSaved?.(evt);
				return `Saved relationship: ${input.from} → ${input.to}`;
			},
		}),
		saveEmotion: tool({
			description: "Save an emotion stage to bible/emotion.md",
			inputSchema: z.object({
				stage: z.number(),
				name: z.string(),
				chapters: z.string(),
				emotions: z.string(),
			}),
			execute: async (input: {
				stage: number;
				name: string;
				chapters: string;
				emotions: string;
			}) => {
				await appendToFile(
					"emotion.md",
					`\n${input.stage}단계 — ${input.name} (${input.chapters})\n${input.emotions}\n`,
				);
				const evt = {
					file: "emotion.md",
					summary: `${input.stage}단계 저장`,
				};
				saves.push(evt);
				await onSaved?.(evt);
				return `Saved emotion stage ${input.stage}`;
			},
		}),
		saveChapterPlan: tool({
			description: "Save a chapter plan to bible/chapters.md",
			inputSchema: z.object({
				number: z.number(),
				title: z.string(),
				scenes: z.array(z.string()),
			}),
			execute: async (input: {
				number: number;
				title: string;
				scenes: string[];
			}) => {
				const scenesText = input.scenes.map((s: string) => `- ${s}`).join("\n");
				await appendToFile(
					"chapters.md",
					`\n## ${input.number}화: ${input.title}\n${scenesText}\n`,
				);
				const evt = {
					file: "chapters.md",
					summary: `${input.number}화 저장`,
				};
				saves.push(evt);
				await onSaved?.(evt);
				return `Saved chapter ${input.number}`;
			},
		}),
		saveStyle: tool({
			description: "Save writing style rules to bible/style.md",
			inputSchema: z.object({
				rules: z.array(z.string()),
			}),
			execute: async (input: { rules: string[] }) => {
				const text = input.rules.map((r) => `- ${r}`).join("\n");
				await appendToFile("style.md", `${text}\n`);
				const evt = { file: "style.md", summary: "필체 저장" };
				saves.push(evt);
				await onSaved?.(evt);
				return "Saved style rules";
			},
		}),
		saveTone: tool({
			description: "Save tone rules to bible/tone.md",
			inputSchema: z.object({
				rules: z.array(z.string()),
			}),
			execute: async (input: { rules: string[] }) => {
				const text = input.rules.map((r) => `- ${r}`).join("\n");
				await appendToFile("tone.md", `${text}\n`);
				const evt = { file: "tone.md", summary: "톤 저장" };
				saves.push(evt);
				await onSaved?.(evt);
				return "Saved tone rules";
			},
		}),
		saveConstraint: tool({
			description: "Save constraints to bible/constraints.md",
			inputSchema: z.object({
				rules: z.array(z.string()),
			}),
			execute: async (input: { rules: string[] }) => {
				const text = input.rules.map((r) => `- ${r}`).join("\n");
				await appendToFile("constraints.md", `${text}\n`);
				const evt = {
					file: "constraints.md",
					summary: "금지사항 저장",
				};
				saves.push(evt);
				await onSaved?.(evt);
				return "Saved constraints";
			},
		}),
		finish: tool({
			description: "End the bible creation session",
			inputSchema: z.object({
				summary: z.string().describe("Summary of what was created"),
			}),
			execute: async (_input: { summary: string }) => {
				finished = true;
				return { done: true };
			},
		}),
	} as const;

	const result = await generateText({
		model,
		system,
		messages,
		tools,
		stopWhen: ({ steps }: { steps: unknown[] }) =>
			steps.length >= MAX_STEPS_PER_TURN,
		temperature: 0.7,
		maxOutputTokens: 2000,
	});

	const assistantText = result.text ?? "";
	if (assistantText) {
		messages.push({ role: "assistant", content: assistantText });
		await onMessage?.(assistantText);
	}

	return {
		text: assistantText,
		saves,
		finished,
		history: messages,
	};
}
