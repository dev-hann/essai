import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	GlobalConfig,
	globalConfigSchema,
	projectConfigSchema,
} from "@essai/core";

export interface ConfigOpts {
	cwd?: string;
	homeDir?: string;
	global?: boolean;
}

export interface ShowConfigOpts extends ConfigOpts {
	stdout?: { write(chunk: string): void };
}

const CONFIG_FILE = "essai.json";
const NUMERIC_KEYS = new Set(["chapterWords", "temperature", "maxTokens"]);
const LLM_KEYS = new Set([
	"baseUrl",
	"apiKey",
	"model",
	"temperature",
	"maxTokens",
	"thinkingEnabled",
]);

const GLOBAL_NUMERIC_KEYS = new Set([
	"defaultChapterWords",
	"defaultTemperature",
]);
const GLOBAL_KEYS = new Set([
	"defaultLanguage",
	"defaultModel",
	"defaultBaseUrl",
	"defaultApiKey",
	"defaultChapterWords",
	"defaultTemperature",
]);

function normalizeKey(key: string): string {
	if (key.includes(".")) return key;
	if (LLM_KEYS.has(key)) return `llm.${key}`;
	return key;
}

type AnyJson =
	| string
	| number
	| boolean
	| null
	| AnyJson[]
	| { [k: string]: AnyJson };

function configPath(cwd: string): string {
	return path.join(cwd, CONFIG_FILE);
}

async function readRaw(cwd: string): Promise<Record<string, AnyJson>> {
	const file = configPath(cwd);
	const raw = await fs.readFile(file, "utf-8");
	return JSON.parse(raw) as Record<string, AnyJson>;
}

async function writeRaw(
	cwd: string,
	data: Record<string, AnyJson>,
): Promise<void> {
	await fs.writeFile(
		configPath(cwd),
		`${JSON.stringify(data, null, 2)}\n`,
		"utf-8",
	);
}

function getByPath(data: Record<string, AnyJson>, dotted: string): unknown {
	const parts = dotted.split(".");
	let cur: unknown = data;
	for (const part of parts) {
		if (typeof cur !== "object" || cur === null || Array.isArray(cur))
			return undefined;
		cur = (cur as Record<string, unknown>)[part];
	}
	return cur;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerce(key: string, raw: string): string | number | boolean {
	if (NUMERIC_KEYS.has(key)) {
		const n = Number(raw);
		if (Number.isNaN(n)) throw new Error(`Value for ${key} must be a number`);
		return n;
	}
	if (raw === "true") return true;
	if (raw === "false") return false;
	return raw;
}

function coerceGlobal(key: string, raw: string): string | number {
	if (GLOBAL_NUMERIC_KEYS.has(key)) {
		const n = Number(raw);
		if (Number.isNaN(n)) throw new Error(`Value for ${key} must be a number`);
		return n;
	}
	return raw;
}

async function setGlobalConfigValue(
	key: string,
	value: string,
	opts: ConfigOpts,
): Promise<void> {
	if (!GLOBAL_KEYS.has(key)) {
		throw new Error(`Unknown global config key: ${key}`);
	}
	const homeDir = opts.homeDir ?? os.homedir();
	const global = await GlobalConfig.load(homeDir);
	const coerced = coerceGlobal(key, value);
	switch (key) {
		case "defaultLanguage":
			global.defaultLanguage = coerced as string;
			break;
		case "defaultModel":
			global.defaultModel = coerced as string;
			break;
		case "defaultBaseUrl":
			global.defaultBaseUrl = coerced as string;
			break;
		case "defaultApiKey":
			global.defaultApiKey = coerced as string;
			break;
		case "defaultChapterWords":
			global.defaultChapterWords = coerced as number;
			break;
		case "defaultTemperature":
			global.defaultTemperature = coerced as number;
			break;
	}
	globalConfigSchema.parse(global.toJSON());
	await global.save(homeDir);
}
export async function getConfigValue(
	key: string,
	opts: ConfigOpts = {},
): Promise<unknown> {
	const data = await readRaw(opts.cwd ?? process.cwd());
	return getByPath(data, normalizeKey(key));
}

export async function setConfigValue(
	key: string,
	value: string,
	opts: ConfigOpts = {},
): Promise<void> {
	if (opts.global) {
		await setGlobalConfigValue(key, value, opts);
		return;
	}
	const cwd = opts.cwd ?? process.cwd();
	const data = await readRaw(cwd);

	const normalized = normalizeKey(key);
	const parts = normalized.split(".");
	const lastPart = parts[parts.length - 1];
	if (!lastPart) throw new Error(`Invalid key: ${key}`);

	let parent: Record<string, unknown> = data;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (!part) throw new Error(`Invalid key: ${key}`);
		const next = parent[part];
		if (!isObject(next)) {
			throw new Error(`Unknown config key: ${key}`);
		}
		parent = next;
	}

	if (!(lastPart in parent)) {
		throw new Error(`Unknown config key: ${key}`);
	}

	parent[lastPart] = coerce(lastPart, value);

	// Re-validate the full config against the schema before persisting.
	projectConfigSchema.parse(data);
	await writeRaw(cwd, data);
}

export async function showConfig(opts: ShowConfigOpts = {}): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const data = await readRaw(cwd);
	const stdout = opts.stdout ?? process.stdout;
	stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
