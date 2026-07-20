import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	type GlobalConfigData,
	type GlobalProjectEntry,
	globalConfigSchema,
} from "./schema.js";

const CONFIG_DIR = ".essai";
const CONFIG_FILE = "config.json";

export class GlobalConfig {
	defaultLanguage: string;
	defaultModel: string;
	defaultBaseUrl: string;
	defaultApiKey: string;
	defaultChapterWords: number;
	defaultTemperature: number;
	projects: GlobalProjectEntry[];

	constructor(data: GlobalConfigData) {
		this.defaultLanguage = data.defaultLanguage;
		this.defaultModel = data.defaultModel;
		this.defaultBaseUrl = data.defaultBaseUrl;
		this.defaultApiKey = data.defaultApiKey;
		this.defaultChapterWords = data.defaultChapterWords;
		this.defaultTemperature = data.defaultTemperature;
		this.projects = data.projects.map((p) => ({ ...p }));
	}

	toJSON(): GlobalConfigData {
		return {
			defaultLanguage: this.defaultLanguage,
			defaultModel: this.defaultModel,
			defaultBaseUrl: this.defaultBaseUrl,
			defaultApiKey: this.defaultApiKey,
			defaultChapterWords: this.defaultChapterWords,
			defaultTemperature: this.defaultTemperature,
			projects: this.projects.map((p) => ({ ...p })),
		};
	}

	static configPath(homeDir?: string): string {
		return path.join(homeDir ?? os.homedir(), CONFIG_DIR, CONFIG_FILE);
	}

	private static defaults(): GlobalConfig {
		return new GlobalConfig(globalConfigSchema.parse({}));
	}

	static async load(homeDir?: string): Promise<GlobalConfig> {
		const file = GlobalConfig.configPath(homeDir);
		let raw: string;
		try {
			raw = await fs.readFile(file, "utf-8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				return GlobalConfig.defaults();
			}
			throw err;
		}
		const data = globalConfigSchema.parse(JSON.parse(raw));
		return new GlobalConfig(data);
	}

	async save(homeDir?: string): Promise<void> {
		const file = GlobalConfig.configPath(homeDir);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(
			file,
			`${JSON.stringify(this.toJSON(), null, 2)}\n`,
			"utf-8",
		);
	}

	static generateProjectId(name: string, projectPath: string): string {
		const basename = path.basename(projectPath);
		return basename || name;
	}

	addProject(name: string, projectPath: string): void {
		this.projects = this.projects.filter(
			(p) => p.path !== projectPath && p.name !== name,
		);
		const id = GlobalConfig.generateProjectId(name, projectPath);
		this.projects.push({ name, path: projectPath, id });
	}

	getProject(id: string): GlobalProjectEntry | undefined {
		const project = this.projects.find((p) => p.id === id);
		return project ? { ...project } : undefined;
	}

	updateLastVisited(id: string): void {
		const project = this.projects.find((p) => p.id === id);
		if (project) {
			project.lastVisited = new Date().toISOString();
		}
	}

	listProjects(): GlobalProjectEntry[] {
		return this.projects.map((p) => ({ ...p }));
	}
}
