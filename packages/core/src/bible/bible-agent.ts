import { promises as fs } from "node:fs";
import path from "node:path";
import { generateText, tool } from "ai";
import { z } from "zod";
import type { LanguageModel } from "ai";
import type { ProjectConfig } from "../config/project-config.js";

export interface BibleAgentCallbacks {
  onMessage: (message: string) => void;
  onInput: () => Promise<string>;
  onSaved: (file: string, summary: string) => void;
}

export class BibleAgent {
  private readonly projectDir: string;
  private messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  constructor(
    private readonly config: ProjectConfig,
    private readonly model: LanguageModel,
    projectDir: string = ".",
  ) {
    this.projectDir = projectDir;
  }

  async run(callbacks: BibleAgentCallbacks): Promise<void> {
    const { onMessage, onInput, onSaved } = callbacks;
    const bibleDir = path.join(this.projectDir, "bible");
    await fs.mkdir(bibleDir, { recursive: true });

    const system = [
      "You are a story development agent. Have a natural conversation with the author to flesh out their story bible.",
      "Ask ONE question at a time. Listen to answers and ask contextual follow-ups.",
      "Use tools to save information as you learn it.",
      "Cover: characters, relationships, emotion arc, chapter plans, writing style, tone, constraints.",
      `Respond in ${this.config.language}.`,
      "When the author says they're done or all sections are covered, call finish.",
    ].join("\n");

    const self = this;

    const tools = {
      saveCharacter: tool({
        description: "Save a character to bible/characters.md",
        inputSchema: z.object({
          name: z.string(),
          details: z.string().describe("Full character description"),
        }),
        execute: async (input: { name: string; details: string }) => {
          await self.appendToFile("characters.md", `\n## ${input.name}\n${input.details}\n`);
          onSaved("characters.md", `${input.name} 저장`);
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
        execute: async (input: { from: string; to: string; description: string }) => {
          await self.appendToFile("relationships.md", `${input.from} → ${input.to}: ${input.description}\n`);
          onSaved("relationships.md", `${input.from} → ${input.to} 저장`);
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
        execute: async (input: { stage: number; name: string; chapters: string; emotions: string }) => {
          await self.appendToFile("emotion.md", `\n${input.stage}단계 — ${input.name} (${input.chapters})\n${input.emotions}\n`);
          onSaved("emotion.md", `${input.stage}단계 저장`);
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
        execute: async (input: { number: number; title: string; scenes: string[] }) => {
          const scenesText = input.scenes.map((s: string) => `- ${s}`).join("\n");
          await self.appendToFile("chapters.md", `\n## ${input.number}화: ${input.title}\n${scenesText}\n`);
          onSaved("chapters.md", `${input.number}화 저장`);
          return `Saved chapter ${input.number}`;
        },
      }),
      saveStyle: tool({
        description: "Save writing style rules to bible/style.md",
        inputSchema: z.object({
          rules: z.array(z.string()),
        }),
        execute: async (input: { rules: string[] }) => {
          const text = input.rules.map((r: string) => `- ${r}`).join("\n");
          await self.appendToFile("style.md", `${text}\n`);
          onSaved("style.md", "필체 저장");
          return `Saved style rules`;
        },
      }),
      saveTone: tool({
        description: "Save tone rules to bible/tone.md",
        inputSchema: z.object({
          rules: z.array(z.string()),
        }),
        execute: async (input: { rules: string[] }) => {
          const text = input.rules.map((r: string) => `- ${r}`).join("\n");
          await self.appendToFile("tone.md", `${text}\n`);
          onSaved("tone.md", "톤 저장");
          return `Saved tone rules`;
        },
      }),
      saveConstraint: tool({
        description: "Save constraints to bible/constraints.md",
        inputSchema: z.object({
          rules: z.array(z.string()),
        }),
        execute: async (input: { rules: string[] }) => {
          const text = input.rules.map((r: string) => `- ${r}`).join("\n");
          await self.appendToFile("constraints.md", `${text}\n`);
          onSaved("constraints.md", "금지사항 저장");
          return `Saved constraints`;
        },
      }),
      finish: tool({
        description: "End the bible creation session",
        inputSchema: z.object({
          summary: z.string().describe("Summary of what was created"),
        }),
        execute: async (input: { summary: string }) => {
          return { done: true, summary: input.summary };
        },
      }),
    } as const;

    this.messages.push({
      role: "user",
      content: "안녕하세요. 새로운 이야기를 만들고 싶습니다. 도와주세요.",
    });

    let done = false;
    let steps = 0;
    const maxSteps = 30;

    while (!done && steps < maxSteps) {
      steps++;

      const result = await generateText({
        model: this.model,
        system,
        messages: this.messages,
        tools,
        stopWhen: ({ steps }) => steps.length >= 1,
        temperature: 0.7,
        maxOutputTokens: 2000,
      });

      if (result.text) {
        onMessage(result.text);
        this.messages.push({ role: "assistant", content: result.text });
      }

      const toolResults = result.toolCalls ?? [];
      for (const tc of toolResults) {
        if (tc.toolName === "finish") {
          done = true;
        }
      }

      if (done) break;

      const userInput = await onInput();
      if (userInput.toLowerCase() === "done" || userInput.toLowerCase() === "quit") {
        break;
      }
      this.messages.push({ role: "user", content: userInput });
    }

    if (!done) {
      onMessage("세션이 종료되었습니다. bible/ 폴더를 확인해주세요.");
    }
  }

  private async appendToFile(filename: string, content: string): Promise<void> {
    const filePath = path.join(this.projectDir, "bible", filename);
    let existing = "";
    try {
      existing = await fs.readFile(filePath, "utf-8");
    } catch {
      // File doesn't exist yet
    }
    await fs.writeFile(filePath, existing + content, "utf-8");
  }
}
