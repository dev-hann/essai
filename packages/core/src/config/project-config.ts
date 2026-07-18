import { promises as fs } from "node:fs";
import path from "node:path";
import { type ProjectConfigData, projectConfigSchema } from "./schema.js";

const CONFIG_FILENAME = "essai.json";
const MASKED_KEY = "***";

export class ProjectConfig {
	name: string;
	language: string;
	chapterWords: number;
	llm: ProjectConfigData["llm"];

	constructor(data: ProjectConfigData) {
		this.name = data.name;
		this.language = data.language;
		this.chapterWords = data.chapterWords;
		this.llm = data.llm;
	}

	toJSON(): ProjectConfigData {
		return {
			name: this.name,
			language: this.language,
			chapterWords: this.chapterWords,
			llm: { ...this.llm },
		};
	}

	static async load(dir: string): Promise<ProjectConfig> {
		const file = path.join(dir, CONFIG_FILENAME);
		const raw = await fs.readFile(file, "utf-8");
		const data = projectConfigSchema.parse(JSON.parse(raw));
		return new ProjectConfig(data);
	}

	async save(dir: string): Promise<void> {
		const file = path.join(dir, CONFIG_FILENAME);
		const masked: ProjectConfigData = {
			...this.toJSON(),
			llm: { ...this.llm, apiKey: MASKED_KEY },
		};
		await fs.writeFile(file, `${JSON.stringify(masked, null, 2)}\n`, "utf-8");
	}

	static fromEnv(): ProjectConfig {
		const env = process.env;
		return new ProjectConfig({
			name: "",
			language: env.ESSAI_LANGUAGE ?? "en",
			chapterWords: 3000,
			llm: {
				baseUrl: env.ESSAI_BASE_URL ?? "",
				apiKey: env.ESSAI_API_KEY ?? "",
				model: env.ESSAI_MODEL ?? "",
				temperature: 0.7,
				maxTokens: 8000,
				thinkingEnabled: false,
			},
		});
	}
}
