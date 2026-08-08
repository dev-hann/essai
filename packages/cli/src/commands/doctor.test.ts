import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { doctorCommand } from "./doctor.js";

function capture(): { output: string; write(c: string): void } {
	let output = "";
	return {
		get output() {
			return output;
		},
		write(c: string) {
			output += c;
		},
	};
}

async function writeProject(
	root: string,
	files: Record<string, string>,
): Promise<void> {
	for (const [relative, content] of Object.entries(files)) {
		const fullPath = path.join(root, relative);
		await fs.mkdir(path.dirname(fullPath), { recursive: true });
		await fs.writeFile(fullPath, content, "utf-8");
	}
}

describe("doctor", () => {
	let tmp: string;

	beforeEach(async () => {
		tmp = await fs.mkdtemp(path.join(os.tmpdir(), "essai-doctor-"));
	});

	afterEach(async () => {
		// doctor sets process.exitCode as a side effect; reset between tests so
		// a failure in one doesn't bleed into the exit code of unrelated tests.
		process.exitCode = undefined;
		await fs.rm(tmp, { recursive: true, force: true });
	});

	it("flags missing essai.json as an error", async () => {
		const out = capture();
		await doctorCommand({ cwd: tmp, stdout: out });
		expect(out.output).toMatch(/✗\s+essai\.json/);
		expect(out.output).toMatch(/[1-9]\d* error\(s\)/);
	});

	it("shows the project config when essai.json is valid", async () => {
		await writeProject(tmp, {
			"essai.json": JSON.stringify({
				name: "x",
				language: "ko",
				chapterWords: 1000,
				llm: {
					baseUrl: "https://example.com",
					apiKey: "k",
					model: "glm-5.1",
					temperature: 0.7,
					maxTokens: 1000,
					thinkingEnabled: false,
				},
			}),
		});
		const out = capture();
		await doctorCommand({ cwd: tmp, stdout: out });
		expect(out.output).toMatch(/✓\s+essai\.json/);
		expect(out.output).toMatch(/language=ko/);
	});

	it("warns when LLM fields are missing", async () => {
		await writeProject(tmp, {
			"essai.json": JSON.stringify({
				name: "x",
				language: "ko",
				chapterWords: 1000,
				llm: {
					baseUrl: "",
					apiKey: "",
					model: "",
					temperature: 0.7,
					maxTokens: 1000,
					thinkingEnabled: false,
				},
			}),
		});
		const out = capture();
		await doctorCommand({ cwd: tmp, stdout: out });
		expect(out.output).toMatch(/✗\s+LLM endpoint/);
		expect(out.output).toMatch(/missing: baseUrl, apiKey, model/);
	});

	it("warns (not errors) on empty bible/", async () => {
		await writeProject(tmp, {
			"essai.json": JSON.stringify({
				name: "x",
				language: "ko",
				chapterWords: 1000,
				llm: {
					baseUrl: "https://example.com",
					apiKey: "k",
					model: "glm-5.1",
					temperature: 0.7,
					maxTokens: 1000,
					thinkingEnabled: false,
				},
			}),
		});
		await fs.mkdir(path.join(tmp, "bible"), { recursive: true });
		const out = capture();
		await doctorCommand({ cwd: tmp, stdout: out });
		expect(out.output).toMatch(/⚠\s+bible\/.*empty/);
		// Empty bible is a warning, not an error — exit code should stay clean.
		expect(out.output).not.toMatch(/\d+[1-9] error\(s\)/);
	});

	it("validates the latest chapter when chapters exist", async () => {
		await writeProject(tmp, {
			"essai.json": JSON.stringify({
				name: "x",
				language: "ko",
				chapterWords: 1000,
				llm: {
					baseUrl: "https://example.com",
					apiKey: "k",
					model: "glm-5.1",
					temperature: 0.7,
					maxTokens: 1000,
					thinkingEnabled: false,
				},
			}),
			"bible/characters.md": "## 도윤\n- age: 25\n",
			"chapters/001.md": "비가 내렸다. 도윤은 카페에 앉았다.",
		});
		const out = capture();
		await doctorCommand({ cwd: tmp, stdout: out });
		expect(out.output).toMatch(/validate ch1/);
		expect(out.output).toMatch(/ok, \d+ warning/);
	});

	it("counts memory JSON schema failures", async () => {
		await writeProject(tmp, {
			"essai.json": JSON.stringify({
				name: "x",
				language: "ko",
				chapterWords: 1000,
				llm: {
					baseUrl: "https://example.com",
					apiKey: "k",
					model: "glm-5.1",
					temperature: 0.7,
					maxTokens: 1000,
					thinkingEnabled: false,
				},
			}),
			// Valid memory entry
			"memory/001.json": JSON.stringify({
				chapter: 1,
				title: "x",
				wordCount: 100,
				events: [],
				emotions: [],
				foreshadowing: [],
				facts: [],
				characterState: {},
				propsIntroduced: [],
				propsUsed: [],
				languageLevel: [],
			}),
			// Invalid memory entry (missing required fields)
			"memory/002.json": JSON.stringify({ bogus: true }),
		});
		const out = capture();
		await doctorCommand({ cwd: tmp, stdout: out });
		expect(out.output).toMatch(/memory\/.*1\/2 valid/);
	});
});
