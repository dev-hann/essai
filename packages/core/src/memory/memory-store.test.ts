import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChapterMemory } from "./types.js";
import { MemoryStore } from "./memory-store.js";

function makeMemory(chapter: number, overrides: Partial<ChapterMemory> = {}): ChapterMemory {
	return {
		chapter,
		title: `Chapter ${chapter}`,
		wordCount: 1000 * chapter,
		events: [`event-${chapter}`],
		emotions: [],
		foreshadowing: [],
		facts: [],
		characterState: {},
		...overrides,
	};
}

describe("MemoryStore", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-mem-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	describe("save", () => {
		it("writes memory/NNN.json with zero-padded filename", async () => {
			const store = new MemoryStore();
			await store.save(tmp, makeMemory(1));

			const file = path.join(tmp, "001.json");
			const raw = await fs.readFile(file, "utf-8");
			const parsed = JSON.parse(raw);
			expect(parsed.chapter).toBe(1);
			expect(parsed.title).toBe("Chapter 1");
		});

		it("zero-pads three digits", async () => {
			const store = new MemoryStore();
			await store.save(tmp, makeMemory(42));

			const entries = await fs.readdir(tmp);
			expect(entries).toContain("042.json");
		});

		it("creates the memory directory if missing", async () => {
			const store = new MemoryStore();
			const dir = path.join(tmp, "nested", "memory");
			await store.save(dir, makeMemory(1));

			const stat = await fs.stat(path.join(dir, "001.json"));
			expect(stat.isFile()).toBe(true);
		});

		it("overwrites an existing memory for the same chapter", async () => {
			const store = new MemoryStore();
			await store.save(tmp, makeMemory(1, { title: "old" }));
			await store.save(tmp, makeMemory(1, { title: "new" }));

			const loaded = await store.load(tmp, 1);
			expect(loaded?.title).toBe("new");
		});
	});

	describe("load", () => {
		it("returns null when the file does not exist", async () => {
			const store = new MemoryStore();
			expect(await store.load(tmp, 99)).toBeNull();
		});

		it("returns the parsed memory when the file exists", async () => {
			const store = new MemoryStore();
			await store.save(tmp, makeMemory(3, { title: "삼화" }));

			const loaded = await store.load(tmp, 3);
			expect(loaded).not.toBeNull();
			expect(loaded?.chapter).toBe(3);
			expect(loaded?.title).toBe("삼화");
		});

		it("validates the loaded JSON against the schema", async () => {
			const file = path.join(tmp, "001.json");
			await fs.writeFile(file, JSON.stringify({ chapter: 1 }), "utf-8");

			const store = new MemoryStore();
			await expect(store.load(tmp, 1)).rejects.toThrow();
		});

		it("returns null when the memory directory does not exist", async () => {
			const store = new MemoryStore();
			expect(await store.load(path.join(tmp, "does-not-exist"), 1)).toBeNull();
		});
	});

	describe("loadRecent", () => {
		it("returns the N most recent memories ordered by chapter ascending", async () => {
			const store = new MemoryStore();
			for (const n of [1, 2, 3, 4, 5]) await store.save(tmp, makeMemory(n));

			const recent = await store.loadRecent(tmp, 3);
			expect(recent.map((m) => m.chapter)).toEqual([3, 4, 5]);
		});

		it("returns fewer when fewer memories exist", async () => {
			const store = new MemoryStore();
			await store.save(tmp, makeMemory(1));
			await store.save(tmp, makeMemory(2));

			const recent = await store.loadRecent(tmp, 5);
			expect(recent.map((m) => m.chapter)).toEqual([1, 2]);
		});

		it("returns an empty array when no memories exist", async () => {
			const store = new MemoryStore();
			expect(await store.loadRecent(tmp, 3)).toEqual([]);
		});

		it("returns an empty array when the directory does not exist", async () => {
			const store = new MemoryStore();
			expect(await store.loadRecent(path.join(tmp, "missing"), 3)).toEqual([]);
		});

		it("skips files that are not memory JSON without throwing", async () => {
			await fs.writeFile(path.join(tmp, "001.json"), JSON.stringify(makeMemory(1)));
			await fs.writeFile(path.join(tmp, "notes.md"), "# notes");

			const store = new MemoryStore();
			const recent = await store.loadRecent(tmp, 3);
			expect(recent.map((m) => m.chapter)).toEqual([1]);
		});
	});
});
