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
	/** Print the global config instead of the project essai.json. */
	global?: boolean;
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
	const stdout = opts.stdout ?? process.stdout;
	if (opts.global) {
		const homeDir = opts.homeDir ?? os.homedir();
		const global = await GlobalConfig.load(homeDir);
		stdout.write(`${JSON.stringify(global.toJSON(), null, 2)}\n`);
		return;
	}
	const cwd = opts.cwd ?? process.cwd();
	const data = await readRaw(cwd);
	stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export interface ExportGlobalOptions extends ConfigOpts {
	/** Where to write the export. Defaults to stdout. */
	stdout?: { write(chunk: string): void };
	/** Omit apiKey from the export so it can be shared (e.g. in a PR). */
	redact?: boolean;
}

/**
 * Dump the global config (~/.essai/config.json) as JSON. Useful for
 * backing up LLM defaults + project registry before a machine wipe, or
 * for sharing setup with a collaborator (with --redact to strip the
 * apiKey). Round-trips cleanly with `config import`.
 */
export async function exportGlobalConfig(
	opts: ExportGlobalOptions = {},
): Promise<void> {
	const homeDir = opts.homeDir ?? os.homedir();
	const stdout = opts.stdout ?? process.stdout;
	const global = await GlobalConfig.load(homeDir);
	const json = global.toJSON();
	if (opts.redact) {
		json.defaultApiKey = "<redacted>";
		for (const project of json.projects) {
			// Projects don't carry their own apiKey (they inherit), so
			// there's nothing to scrub here. The redaction is purely for
			// the top-level defaultApiKey.
			void project;
		}
	}
	stdout.write(`${JSON.stringify(json, null, 2)}\n`);
}

export interface ImportGlobalOptions extends ConfigOpts {
	/** Source JSON string (already-read). */
	input: string;
	/** Merge into existing config instead of replacing it. */
	merge?: boolean;
	/** Skip the apiKey field from the imported payload. */
	skipApiKey?: boolean;
}

/**
 * Replace (or merge into) the global config from a JSON payload. The
 * payload is re-validated through the same zod schema that `load` uses,
 * so malformed imports are rejected before touching disk.
 *
 * Merge semantics: scalar fields (defaultModel, defaultBaseUrl, etc.)
 * are overwritten when present in the import. The `projects` array is
 * unioned by id (imported ids win on collision).
 */
export async function importGlobalConfig(
	opts: ImportGlobalOptions,
): Promise<void> {
	const homeDir = opts.homeDir ?? os.homedir();
	const parsed = JSON.parse(opts.input) as Record<string, unknown>;
	if (opts.skipApiKey && "defaultApiKey" in parsed) {
		delete parsed.defaultApiKey;
	}

	// Validate before touching disk. Throws on schema mismatch.
	const incoming = globalConfigSchema.parse(parsed);

	const current = await GlobalConfig.load(homeDir).catch(() => null);

	// Without --merge we still need to honor --skip-api-key: pull the
	// current apiKey back in so the replace path doesn't wipe it.
	let finalData = incoming;
	if (opts.skipApiKey && current) {
		finalData = {
			...incoming,
			defaultApiKey: current.defaultApiKey,
		};
	}

	const merged =
		opts.merge && current
			? mergeGlobalData(current.toJSON(), finalData)
			: finalData;

	const next = new GlobalConfig(merged);
	await next.save(homeDir);
}

function mergeGlobalData(
	current: {
		defaultLanguage: string;
		defaultModel: string;
		defaultBaseUrl: string;
		defaultApiKey: string;
		defaultChapterWords: number;
		defaultTemperature: number;
		projects: Array<{ name: string; path: string; id: string }>;
	},
	incoming: {
		defaultLanguage?: string;
		defaultModel?: string;
		defaultBaseUrl?: string;
		defaultApiKey?: string;
		defaultChapterWords?: number;
		defaultTemperature?: number;
		projects?: Array<{ name: string; path: string; id: string }>;
	},
): {
	defaultLanguage: string;
	defaultModel: string;
	defaultBaseUrl: string;
	defaultApiKey: string;
	defaultChapterWords: number;
	defaultTemperature: number;
	projects: Array<{ name: string; path: string; id: string }>;
} {
	const byId = new Map<string, { name: string; path: string; id: string }>();
	for (const p of current.projects) byId.set(p.id, p);
	for (const p of incoming.projects ?? []) byId.set(p.id, p);
	// Treat empty string as "not set" so zod defaults (which fill missing
	// fields with "") don't clobber existing values during a merge.
	const pickStr = (
		incomingValue: string | undefined,
		currentValue: string,
	): string =>
		incomingValue && incomingValue.length > 0 ? incomingValue : currentValue;
	const pickNum = (
		incomingValue: number | undefined,
		currentValue: number,
	): number => (incomingValue !== undefined ? incomingValue : currentValue);
	return {
		defaultLanguage: pickStr(incoming.defaultLanguage, current.defaultLanguage),
		defaultModel: pickStr(incoming.defaultModel, current.defaultModel),
		defaultBaseUrl: pickStr(incoming.defaultBaseUrl, current.defaultBaseUrl),
		defaultApiKey: pickStr(incoming.defaultApiKey, current.defaultApiKey),
		defaultChapterWords: pickNum(
			incoming.defaultChapterWords,
			current.defaultChapterWords,
		),
		defaultTemperature: pickNum(
			incoming.defaultTemperature,
			current.defaultTemperature,
		),
		projects: [...byId.values()],
	};
}
