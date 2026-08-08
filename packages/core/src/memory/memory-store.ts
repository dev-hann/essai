import { promises as fs } from "node:fs";
import path from "node:path";
import type { ChapterMemory } from "./types.js";
import { chapterMemorySchema } from "./types.js";

const PAD_WIDTH = 3;

function padChapter(n: number): string {
	return n.toString().padStart(PAD_WIDTH, "0");
}

function memoryFile(memoryDir: string, chapter: number): string {
	return path.join(memoryDir, `${padChapter(chapter)}.json`);
}

export class MemoryStore {
	async save(memoryDir: string, memory: ChapterMemory): Promise<void> {
		await fs.mkdir(memoryDir, { recursive: true });
		const file = memoryFile(memoryDir, memory.chapter);
		const json = JSON.stringify(memory, null, 2);
		await fs.writeFile(file, `${json}\n`, "utf-8");
	}

	async load(
		memoryDir: string,
		chapter: number,
	): Promise<ChapterMemory | null> {
		const file = memoryFile(memoryDir, chapter);
		let raw: string;
		try {
			raw = await fs.readFile(file, "utf-8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw err;
		}
		return chapterMemorySchema.parse(JSON.parse(raw));
	}

	async loadRecent(memoryDir: string, count: number): Promise<ChapterMemory[]> {
		let entries: string[];
		try {
			entries = await fs.readdir(memoryDir);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
			throw err;
		}

		const jsonFiles = entries.filter((name) => name.endsWith(".json"));
		const memories: ChapterMemory[] = [];
		for (const name of jsonFiles) {
			const raw = await fs.readFile(path.join(memoryDir, name), "utf-8");
			try {
				memories.push(chapterMemorySchema.parse(JSON.parse(raw)));
			} catch {
				// Skip files that don't match the schema (e.g. unrelated JSON).
			}
		}

		memories.sort((a, b) => a.chapter - b.chapter);
		return memories.slice(Math.max(0, memories.length - count));
	}
}
