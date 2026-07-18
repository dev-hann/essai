import { promises as fs } from "node:fs";
import path from "node:path";

export interface InitOptions {
	cwd?: string;
}

const DEFAULT_LANGUAGE = "en";
const DEFAULT_CHAPTER_WORDS = 3000;

const DIRECTORIES = ["bible", "chapters", "memory", "exports"] as const;

const BIBLE_FILES: Record<string, string> = {
	"characters.md": "# Characters\n\n<!-- ## name\n- field: value -->\n",
	"relationships.md": "# Relationships\n\n<!-- - A -> B: description -->\n",
	"emotion.md":
		"# Emotion Curve\n\n<!-- ## 1 stage name (1-3)\n- character: emotion -->\n",
	"chapters.md": "# Chapter Plan\n\n<!-- ## 1: title\n- scene -->\n",
	"style.md": "# Writing Style\n\n<!-- - rule -->\n",
	"tone.md": "# Tone & Mood\n\n<!-- - rule -->\n",
	"constraints.md": "# Constraints\n\n<!-- - rule -->\n",
};

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

	const config = defaultConfig(name ?? path.basename(projectDir));
	await fs.writeFile(
		configFile,
		`${JSON.stringify(config, null, 2)}\n`,
		"utf-8",
	);

	for (const [fileName, content] of Object.entries(BIBLE_FILES)) {
		await fs.writeFile(
			path.join(projectDir, "bible", fileName),
			content,
			"utf-8",
		);
	}

	return projectDir;
}
