import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GlobalConfig } from "@essai/core";

export interface InitOptions {
	cwd?: string;
	homeDir?: string;
}

const DEFAULT_LANGUAGE = "en";
const DEFAULT_CHAPTER_WORDS = 3000;

const DIRECTORIES = ["bible", "chapters", "memory", "exports"] as const;

// init only scaffolds project-level files (essai.json + the four folders).
// Bible content is intentionally left empty: users either run
// `essai bible init <template>` next, or write bible/ files by hand.
// Previously init wrote placeholder .md files into bible/ which then made
// `bible init <template>` refuse with "bible/ already has content".
// Keeping bible/ empty avoids that foot-gun and matches the documented UX
// ("init" -> "bible init" -> "write").

function defaultConfig(name: string) {
	return {
		name,
		language: DEFAULT_LANGUAGE,
		chapterWords: DEFAULT_CHAPTER_WORDS,
		llm: {
			baseUrl: "",
			apiKey: "",
			model: "",
			temperature: 0.7,
			maxTokens: 8000,
			thinkingEnabled: false,
		},
	};
}

export async function createProject(
	name: string | undefined,
	opts: InitOptions = {},
): Promise<string> {
	const cwd = opts.cwd ?? process.cwd();
	const projectDir = name ? path.join(cwd, name) : cwd;
	const configFile = path.join(projectDir, "essai.json");

	if (name) {
		await fs.mkdir(projectDir, { recursive: false });
	} else {
		try {
			await fs.access(configFile);
			throw new Error(`essai.json already exists in ${projectDir}`);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
		}
	}

	for (const dir of DIRECTORIES) {
		await fs.mkdir(path.join(projectDir, dir), { recursive: true });
	}

	const homeDir = opts.homeDir ?? os.homedir();
	const globalConfigFile = GlobalConfig.configPath(homeDir);
	let globalExists = false;
	try {
		await fs.access(globalConfigFile);
		globalExists = true;
	} catch {
		globalExists = false;
	}

	const projectName = name ?? path.basename(projectDir);
	const config = defaultConfig(projectName);

	if (globalExists) {
		const global = await GlobalConfig.load(homeDir);
		config.language = global.defaultLanguage;
		config.llm.model = global.defaultModel;
		config.llm.baseUrl = global.defaultBaseUrl;
		config.llm.apiKey = global.defaultApiKey;
	}

	await fs.writeFile(
		configFile,
		`${JSON.stringify(config, null, 2)}\n`,
		"utf-8",
	);

	if (globalExists) {
		const global = await GlobalConfig.load(homeDir);
		global.addProject(projectName, projectDir);
		await global.save(homeDir);
	}

	return projectDir;
}
