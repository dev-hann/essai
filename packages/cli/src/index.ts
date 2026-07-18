#!/usr/bin/env node
import { CORE_VERSION } from "@essai/core";
import { Command } from "commander";
import {
	getConfigValue,
	setConfigValue,
	showConfig,
} from "./commands/config.js";
import { createProject } from "./commands/init.js";
import { listChapters } from "./commands/list.js";
import { readChapter } from "./commands/read.js";
import { showStatus } from "./commands/status.js";
import { writeChapterCommand } from "./commands/write.js";

function reportError(err: unknown): void {
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(`error: ${message}\n`);
}

type ChapterArg = number | "next";

function parseChapterArg(value: string): ChapterArg {
	if (value === "next") return "next";
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) {
		throw new Error(
			`Invalid chapter: ${value}. Use a positive integer or "next".`,
		);
	}
	return n;
}

export function buildProgram(): Command {
	const program = new Command();

	program
		.name("essai")
		.description("AI writing tool where the author holds the pencil.")
		.version(`essai ${CORE_VERSION}`);

	program
		.command("init [name]")
		.description(
			"Create a new essai project in a subdirectory (or current directory)",
		)
		.action(async (name: string | undefined) => {
			try {
				const projectPath = await createProject(name);
				process.stdout.write(`Created project at ${projectPath}\n`);
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	const config = program
		.command("config")
		.description("Read or update essai.json");

	config
		.command("set <key> <value>")
		.description("Set a config value (e.g. llm.model, language, chapterWords)")
		.action(async (key: string, value: string) => {
			try {
				await setConfigValue(key, value);
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	config
		.command("get <key>")
		.description("Print a single config value")
		.action(async (key: string) => {
			try {
				const value = await getConfigValue(key);
				if (value === undefined) {
					process.stdout.write(`(unset)\n`);
				} else {
					process.stdout.write(
						`${typeof value === "string" ? value : JSON.stringify(value)}\n`,
					);
				}
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	config
		.command("show")
		.description("Print the full essai.json")
		.action(async () => {
			try {
				await showConfig();
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("write <chapter>")
		.description("Write chapter N (or 'next' for the next unfinished chapter)")
		.option("-i, --instruction <text>", "additional instruction for the writer")
		.action(async (chapter: string, opts: { instruction?: string }) => {
			try {
				const arg = parseChapterArg(chapter);
				await writeChapterCommand(arg, {
					...(opts.instruction !== undefined
						? { instruction: opts.instruction }
						: {}),
				});
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("read <chapter>")
		.description("Print chapter N")
		.action(async (chapter: string) => {
			try {
				const n = parseChapterArg(chapter);
				if (n === "next") {
					throw new Error(
						'"read next" is not supported. Use a chapter number.',
					);
				}
				await readChapter(n);
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("list")
		.description("List written chapters with character counts")
		.action(async () => {
			try {
				await listChapters();
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("status")
		.description("Show project progress")
		.action(async () => {
			try {
				await showStatus();
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	return program;
}

const program = buildProgram();
program.parseAsync(process.argv).catch((err: unknown) => {
	reportError(err);
	process.exit(1);
});
