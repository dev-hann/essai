#!/usr/bin/env node
import type { AuditDimensionId } from "@essai/core";
import { CORE_VERSION } from "@essai/core";
import { Command } from "commander";
import { auditCommand } from "./commands/audit.js";
import {
	bibleAdd,
	bibleAgent,
	bibleEdit,
	bibleInit,
	bibleShow,
	bibleValidate,
} from "./commands/bible.js";
import {
	getConfigValue,
	setConfigValue,
	showConfig,
} from "./commands/config.js";
import { contextCommand } from "./commands/context.js";
import { exportCommand } from "./commands/export.js";
import { createProject } from "./commands/init.js";
import { listChapters } from "./commands/list.js";
import { readChapter } from "./commands/read.js";
import { reviewChapterCommand } from "./commands/review.js";
import { rewriteChapterCommand } from "./commands/rewrite.js";
import { serveCommand } from "./commands/serve.js";
import { showStatus } from "./commands/status.js";
import { tuiCommand } from "./commands/tui.js";
import { validateCommand } from "./commands/validate.js";
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
		.option(
			"-g, --global",
			"write to ~/.essai/config.json instead of the project essai.json",
		)
		.action(async (key: string, value: string, opts: { global?: boolean }) => {
			try {
				await setConfigValue(key, value, {
					...(opts.global ? { global: true } : {}),
				});
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
		.option("--raw", "skip the pipeline, just write (no review/fix)")
		.option("--no-fix", "run review but skip auto-fix")
		.action(
			async (
				chapter: string,
				opts: { instruction?: string; raw?: boolean; fix?: boolean },
			) => {
				try {
					const arg = parseChapterArg(chapter);
					await writeChapterCommand(arg, {
						...(opts.instruction !== undefined
							? { instruction: opts.instruction }
							: {}),
						...(opts.raw ? { raw: true } : {}),
						...(opts.fix === false ? { noFix: true } : {}),
					});
				} catch (err) {
					reportError(err);
					process.exit(1);
				}
			},
		);

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

	program
		.command("context <chapter>")
		.description(
			"Preview the context that would be injected when writing chapter N",
		)
		.action(async (chapter: string) => {
			try {
				const n = parseChapterArg(chapter);
				if (n === "next") {
					throw new Error(
						'"context next" is not supported. Use a chapter number.',
					);
				}
				await contextCommand(n);
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("rewrite <chapter>")
		.description("Regenerate chapter N from scratch (overwrites)")
		.option(
			"-i, --instruction <text>",
			"additional instruction for the rewrite",
		)
		.action(async (chapter: string, opts: { instruction?: string }) => {
			try {
				const n = parseChapterArg(chapter);
				if (n === "next") {
					throw new Error(
						'"rewrite next" is not supported. Use a chapter number.',
					);
				}
				await rewriteChapterCommand(n, {
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
		.command("export")
		.description("Concatenate every chapter into a single file")
		.option(
			"-f, --format <format>",
			"output format: md (with chapter headers) or txt (plain)",
			"md",
		)
		.action(async (opts: { format: string }) => {
			try {
				const format = opts.format === "txt" ? "txt" : "md";
				await exportCommand({ format });
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("serve")
		.description("Start the Essai web UI (Next.js dev server)")
		.option("-p, --port <port>", "port (default: 7331)", (value: string) =>
			Number.parseInt(value, 10),
		)
		.option(
			"--start",
			"run the production server instead of dev (requires next build first)",
		)
		.action(async (opts: { port?: number; start?: boolean }) => {
			try {
				await serveCommand({
					...(opts.port !== undefined ? { port: opts.port } : {}),
					...(opts.start ? { mode: "start" as const } : {}),
				});
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("tui")
		.description("Launch the Ink-based terminal UI")
		.action(async () => {
			try {
				await tuiCommand();
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("review <chapter>")
		.description("Generate quality feedback for chapter N")
		.option("-r, --rules <file>", "custom review rules from a markdown file")
		.action(async (chapter: string, opts: { rules?: string }) => {
			try {
				const n = parseChapterArg(chapter);
				if (n === "next") {
					throw new Error(
						'"review next" is not supported. Use a chapter number.',
					);
				}
				await reviewChapterCommand(n, {
					...(opts.rules !== undefined ? { rules: opts.rules } : {}),
				});
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("validate <chapter>")
		.description(
			"Run static continuity checks (floor/prop/timeline) against bible/world.md",
		)
		.option(
			"--disable <rule>",
			"disable a specific rule (floor-consistency, forbidden-props, visa-duration)",
		)
		.action(async (chapter: string, opts: { disable?: string }) => {
			try {
				const n = parseChapterArg(chapter);
				if (n === "next") {
					throw new Error(
						'"validate next" is not supported. Use a chapter number.',
					);
				}
				await validateCommand(n, {
					...(opts.disable !== undefined
						? { disable: opts.disable.split(",") }
						: {}),
				});
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	program
		.command("audit <chapter>")
		.description(
			"Run the LLM continuity auditor across 8 dimensions (character, timeline, setting, emotion, language, pacing, info barrier, craft rules)",
		)
		.option(
			"--only <dimensions>",
			"comma-separated subset of dimensions to run (default: all 8)",
		)
		.action(async (chapter: string, opts: { only?: string }) => {
			try {
				const n = parseChapterArg(chapter);
				if (n === "next") {
					throw new Error(
						'"audit next" is not supported. Use a chapter number.',
					);
				}
				await auditCommand(n, {
					...(opts.only !== undefined
						? { only: opts.only.split(",") as AuditDimensionId[] }
						: {}),
				});
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	const bible = program
		.command("bible")
		.description("Manage the bible/ folder");

	bible
		.command("init [template]")
		.description(
			"Initialize bible/ from a template (blank, romance, fantasy, mystery, scifi)",
		)
		.option("-t, --template <name>", "template name (positional alternative)")
		.option(
			"--agent",
			"after scaffolding, run the AI-guided Bible agent interactively",
		)
		.action(
			async (
				positional: string | undefined,
				opts: { template?: string; agent?: boolean },
			) => {
				try {
					const template = positional ?? opts.template;
					await bibleInit(template, {
						...(opts.agent ? { agent: true } : {}),
					});
				} catch (err) {
					reportError(err);
					process.exit(1);
				}
			},
		);

	bible
		.command("show")
		.description("Print the bible/ folder as a tree")
		.action(async () => {
			try {
				await bibleShow();
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	bible
		.command("edit [file]")
		.description("Open bible/ (or a specific file) in $EDITOR")
		.action(async (file: string | undefined) => {
			try {
				await bibleEdit(file);
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	bible
		.command("validate")
		.description("Check for missing or empty required sections")
		.action(async () => {
			try {
				await bibleValidate();
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	bible
		.command("add <section>")
		.description("Interactively append an entry to a bible/ file")
		.action(async (section: string) => {
			try {
				await bibleAdd(section);
			} catch (err) {
				reportError(err);
				process.exit(1);
			}
		});

	bible
		.command("agent")
		.description(
			"Run the AI-guided Bible agent against the current bible/ folder (no scaffolding)",
		)
		.action(async () => {
			try {
				await bibleAgent();
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
