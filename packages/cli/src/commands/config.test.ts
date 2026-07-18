import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfigValue, setConfigValue, showConfig } from "./config.js";

interface Captured {
	lines: string[];
	write(chunk: string): void;
}

function newCapture(): Captured {
	const lines: string[] = [];
	return {
		lines,
		write(chunk: string) {
			lines.push(chunk);
		},
	};
}

async function writeConfig(dir: string): Promise<void> {
	const config = {
		name: "demo",
		language: "en",
		chapterWords: 3000,
		llm: {
			baseUrl: "https://api.example.com/v4",
			apiKey: "secret",
			model: "glm-5.1",
			temperature: 0.7,
			maxTokens: 8000,
			thinkingEnabled: false,
		},
	};
	await fs.writeFile(
		path.join(dir, "essai.json"),
		`${JSON.stringify(config, null, 2)}\n`,
		"utf-8",
	);
}

describe("config commands", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-cfg-"));
	});

	afterEach(async () => {
		await fs.rm(tmp, { recursive: true, force: true });
	});

	describe("getConfigValue", () => {
		it("returns a top-level scalar value", async () => {
			await writeConfig(tmp);
			expect(await getConfigValue("language", { cwd: tmp })).toBe("en");
		});

		it("returns a nested llm.model value via dot path", async () => {
			await writeConfig(tmp);
			expect(await getConfigValue("llm.model", { cwd: tmp })).toBe("glm-5.1");
		});

		it("returns undefined for an unknown key", async () => {
			await writeConfig(tmp);
			expect(await getConfigValue("nope", { cwd: tmp })).toBeUndefined();
		});

		it("throws when essai.json is missing", async () => {
			await expect(getConfigValue("language", { cwd: tmp })).rejects.toThrow();
		});
	});

	describe("setConfigValue", () => {
		it("updates a top-level scalar and writes it back", async () => {
			await writeConfig(tmp);
			await setConfigValue("language", "ko", { cwd: tmp });

			const raw = await fs.readFile(path.join(tmp, "essai.json"), "utf-8");
			expect(JSON.parse(raw).language).toBe("ko");
		});

		it("updates a nested llm.model value via dot path", async () => {
			await writeConfig(tmp);
			await setConfigValue("llm.model", "new-model", { cwd: tmp });

			const raw = await fs.readFile(path.join(tmp, "essai.json"), "utf-8");
			expect(JSON.parse(raw).llm.model).toBe("new-model");
		});

		it("coerces numeric chapterWords to a number", async () => {
			await writeConfig(tmp);
			await setConfigValue("chapterWords", "5000", { cwd: tmp });

			const raw = await fs.readFile(path.join(tmp, "essai.json"), "utf-8");
			const parsed = JSON.parse(raw);
			expect(parsed.chapterWords).toBe(5000);
			expect(typeof parsed.chapterWords).toBe("number");
		});

		it("preserves the api key when set explicitly", async () => {
			await writeConfig(tmp);
			await setConfigValue("llm.apiKey", "real-secret", { cwd: tmp });

			const raw = await fs.readFile(path.join(tmp, "essai.json"), "utf-8");
			expect(JSON.parse(raw).llm.apiKey).toBe("real-secret");
		});

		it("rejects an attempt to set an unknown top-level key", async () => {
			await writeConfig(tmp);
			await expect(
				setConfigValue("bogus", "1", { cwd: tmp }),
			).rejects.toThrow();
		});

		it("rejects an attempt to set an unknown llm field", async () => {
			await writeConfig(tmp);
			await expect(
				setConfigValue("llm.bogus", "1", { cwd: tmp }),
			).rejects.toThrow();
		});
	});

	describe("showConfig", () => {
		it("writes the full config as formatted JSON", async () => {
			await writeConfig(tmp);
			const out = newCapture();

			await showConfig({ cwd: tmp, stdout: out });

			const parsed = JSON.parse(out.lines.join(""));
			expect(parsed.name).toBe("demo");
			expect(parsed.llm.model).toBe("glm-5.1");
		});
	});
});
