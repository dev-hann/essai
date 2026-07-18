import { promises as fs } from "node:fs";
import path from "node:path";
import { projectConfigSchema } from "@essai/core";

export interface ConfigOpts {
	cwd?: string;
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
