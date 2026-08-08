import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	GlobalConfig,
	loadBible,
	loadWorld,
	MemoryStore,
	ProjectConfig,
	StaticValidator,
} from "@essai/core";
import { type IoOpts, listChapterFiles, resolveStdout } from "./_shared.js";

/**
 * `essai doctor` — single-command troubleshooting.
 *
 * Walks the most common "why doesn't essai work?" failure modes in order
 * and prints a checklist with green ✓ / red ✗ markers. Exits non-zero
 * when any check fails so it composes well with shell pipelines and CI.
 *
 * Checks:
 *   1. Project essai.json present and schema-valid
 *   2. Global ~/.essai/config.json present (optional, warning if missing)
 *   3. LLM endpoint configured (baseUrl + apiKey + model all non-empty)
 *   4. bible/ folder has content (warns on empty)
 *   5. bible/world.md parses (informational, validates structure)
 *   6. chapters/ has at least one chapter (informational)
 *   7. memory/ JSON files all parse against the schema (warns per failure)
 *   8. Static validator runs against the latest chapter (informational)
 */

export interface DoctorOptions extends IoOpts {
	/** Stop after the first failure instead of running every check. */
	failFast?: boolean;
}

interface CheckResult {
	ok: boolean;
	label: string;
	detail?: string;
	/** When true, a failure is a warning rather than an error. */
	warn?: boolean;
}

export async function doctorCommand(opts: DoctorOptions = {}): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);
	const homeDir = os.homedir();
	const results: CheckResult[] = [];

	const add = (r: CheckResult): void => {
		results.push(r);
		if (opts.failFast && !r.ok && !r.warn) throw new Error("fail-fast");
	};

	// 1. Project config
	const projectConfigPath = path.join(cwd, "essai.json");
	let projectConfig: ProjectConfig | null = null;
	try {
		const raw = await fs.readFile(projectConfigPath, "utf-8");
		projectConfig = await ProjectConfig.load(cwd);
		add({
			ok: true,
			label: "essai.json",
			detail: `language=${projectConfig.language} model=${projectConfig.llm.model || "(unset)"}`,
		});
		void raw;
	} catch (err) {
		add({
			ok: false,
			label: "essai.json",
			detail: `missing or invalid: ${(err as Error).message}`,
		});
	}

	// 2. Global config
	try {
		const global = await GlobalConfig.load(homeDir);
		const projectCount = global.listProjects().length;
		add({
			ok: true,
			label: "global config",
			detail: `~/.essai/config.json (${projectCount} project${projectCount === 1 ? "" : "s"} registered)`,
		});
	} catch (err) {
		add({
			ok: false,
			warn: true,
			label: "global config",
			detail: `unreadable: ${(err as Error).message}`,
		});
	}

	// 3. LLM endpoint
	if (projectConfig) {
		const llm = projectConfig.llm;
		const allSet = Boolean(llm.baseUrl && llm.apiKey && llm.model);
		const missing: string[] = [];
		if (!llm.baseUrl) missing.push("baseUrl");
		if (!llm.apiKey) missing.push("apiKey");
		if (!llm.model) missing.push("model");
		add({
			ok: allSet,
			label: "LLM endpoint",
			detail: allSet
				? `${llm.model} @ ${llm.baseUrl}`
				: `missing: ${missing.join(", ")}`,
		});
	}

	// 4. bible/ content
	const bibleDir = path.join(cwd, "bible");
	try {
		const entries = await fs.readdir(bibleDir);
		const mdFiles = entries.filter((e) => e.endsWith(".md"));
		add({
			ok: mdFiles.length > 0,
			label: "bible/",
			detail:
				mdFiles.length === 0
					? "empty (run `essai bible init <template>`)"
					: `${mdFiles.length} file(s): ${mdFiles.slice(0, 5).join(", ")}${mdFiles.length > 5 ? ", …" : ""}`,
			warn: mdFiles.length === 0,
		});
	} catch (err) {
		add({
			ok: false,
			label: "bible/",
			detail: `not a directory: ${(err as Error).message}`,
			warn: true,
		});
	}

	// 5. world.md (informational)
	try {
		const world = await loadWorld(bibleDir);
		const total =
			world.locations.length + world.props.length + world.timeline.length;
		add({
			ok: true,
			label: "bible/world.md",
			detail:
				total === 0
					? "(absent or empty — optional, validator will skip world rules)"
					: `${world.locations.length} location(s), ${world.props.length} prop(s), ${world.timeline.length} timeline entr(y|ies)`,
			warn: total === 0,
		});
	} catch (err) {
		add({
			ok: false,
			label: "bible/world.md",
			detail: `parse error: ${(err as Error).message}`,
			warn: true,
		});
	}

	// 6. chapters/
	try {
		const chapterNames = await listChapterFiles(cwd);
		add({
			ok: true,
			label: "chapters/",
			detail:
				chapterNames.length === 0
					? "empty (run `essai write 1` to start)"
					: `${chapterNames.length} chapter(s), latest: ${chapterNames[chapterNames.length - 1]}`,
			warn: chapterNames.length === 0,
		});
	} catch {
		add({
			ok: false,
			label: "chapters/",
			detail: "not readable",
			warn: true,
		});
	}

	// 7. memory/ JSON validity
	try {
		const memoryDir = path.join(cwd, "memory");
		const entries = await fs.readdir(memoryDir);
		const memoryStore = new MemoryStore();
		const recent = await memoryStore.loadRecent(memoryDir, 50);
		const invalidCount = entries.length - recent.length;
		add({
			ok: invalidCount === 0,
			label: "memory/",
			detail:
				entries.length === 0
					? "empty (memory is generated on chapter write)"
					: `${recent.length}/${entries.length} valid memory JSON(s)${invalidCount > 0 ? ` (${invalidCount} failed schema)` : ""}`,
			warn: entries.length === 0,
		});
	} catch {
		add({
			ok: true,
			label: "memory/",
			detail: "directory absent (will be created on first write)",
			warn: true,
		});
	}

	// 8. Static validator sanity check on latest chapter
	if (projectConfig) {
		try {
			const chapters = await listChapterFiles(cwd);
			if (chapters.length > 0) {
				const latestName = chapters[chapters.length - 1];
				if (latestName) {
					const latestNum = Number.parseInt(latestName.replace(/\D/g, ""), 10);
					const latestPath = path.join(cwd, "chapters", latestName);
					const content = await fs.readFile(latestPath, "utf-8");
					const world = await loadWorld(bibleDir);
					const bible = await loadBible(bibleDir).catch(() => null);
					void bible;
					const validator = new StaticValidator({
						language: projectConfig.language,
					});
					const findings = validator.validate(content, world);
					const errors = findings.filter((f) => f.severity === "error");
					add({
						ok: errors.length === 0,
						label: `validate ch${latestNum}`,
						detail:
							findings.length === 0
								? "no findings"
								: `${errors.length} error(s), ${findings.length - errors.length} warning(s)/info(s)`,
						warn: errors.length === 0 && findings.length > 0,
					});
				}
			}
		} catch (err) {
			add({
				ok: true,
				label: "validate latest",
				detail: `skipped: ${(err as Error).message}`,
				warn: true,
			});
		}
	}

	// Render
	stdout.write(`essai doctor — ${cwd}\n\n`);
	for (const r of results) {
		const mark = r.ok ? "✓" : r.warn ? "⚠" : "✗";
		stdout.write(`  ${mark} ${r.label}${r.detail ? ` — ${r.detail}` : ""}\n`);
	}

	const errors = results.filter((r) => !r.ok && !r.warn);
	const warnings = results.filter((r) => !r.ok && r.warn);
	stdout.write(
		`\n${results.length - errors.length - warnings.length} ok, ${warnings.length} warning(s), ${errors.length} error(s)\n`,
	);
	if (errors.length > 0) {
		process.exitCode = 1;
	}
}
