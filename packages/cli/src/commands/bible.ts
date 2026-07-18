import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTemplate } from "@essai/core";
import { type IoOpts, resolveStdout } from "./_shared.js";

const BIBLE_DIR = "bible";
const TEMPLATE_REFERENCE_FILE = "template.md";

const STANDARD_SECTIONS = [
	"characters",
	"relationships",
	"emotion",
	"chapters",
	"style",
	"tone",
	"constraints",
] as const;

const PLACEHOLDER_CONTENT: Record<string, string> = {
	"characters.md": "# Characters\n\n## Name\n- field: value\n",
	"relationships.md": "# Relationships\n\n- A → B: description\n",
	"emotion.md":
		"# Emotion Curve\n\n## 1단계 — name (1~3화)\n- character: emotion\n",
	"chapters.md": "# Chapter Plan\n\n## 1화: title\n- scene\n",
	"style.md": "# Writing Style\n\n- rule\n",
	"tone.md": "# Tone & Mood\n\n- rule\n",
	"constraints.md": "# Constraints\n\n- rule\n",
};

const DEFAULT_EDITOR = "vi";

export interface BibleOpts extends IoOpts {
	templatesDir?: string;
	agent?: boolean;
}

export interface BibleEditOpts extends IoOpts {
	editor?: string;
	spawn?: (cmd: string, args: string[]) => Promise<void>;
}

export interface BibleAddOpts extends IoOpts {
	prompt?: (question: string) => Promise<string>;
}

export interface ValidationResult {
	missing: string[];
	empty: string[];
	ok: boolean;
}

function biblePath(cwd: string): string {
	return path.join(cwd, BIBLE_DIR);
}

function sectionToFileName(section: string): string {
	return `${section}.md`;
}

const SECTION_KEYWORD_MAP: Array<{ keyword: string; file: string }> = [
	{ keyword: "character", file: "characters.md" },
	{ keyword: "relationship", file: "relationships.md" },
	{ keyword: "emotion", file: "emotion.md" },
	{ keyword: "chapter", file: "chapters.md" },
	{ keyword: "style", file: "style.md" },
	{ keyword: "tone", file: "tone.md" },
	{ keyword: "constraint", file: "constraints.md" },
];

function mapHeadingToFile(heading: string): string {
	const lower = heading.toLowerCase();
	for (const entry of SECTION_KEYWORD_MAP) {
		if (lower.includes(entry.keyword)) return entry.file;
	}
	return `${heading.toLowerCase().replace(/\s+/g, "-")}.md`;
}

function splitTemplateSections(
	content: string,
): { heading: string; body: string }[] {
	const lines = content.split(/\r?\n/);
	const sections: { heading: string; body: string }[] = [];
	let inFrontmatter = false;
	let inComment = false;
	let current: { heading: string; body: string } | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "---") {
			inFrontmatter = !inFrontmatter;
			continue;
		}
		if (inFrontmatter) continue;

		// Track multi-line HTML comments so example ## entries inside
		// <!-- --> blocks do not get treated as new sections.
		const commentStarts = trimmed.startsWith("<!--");
		const commentEnds = trimmed.endsWith("-->");
		if (commentStarts && !commentEnds) inComment = true;
		if (commentStarts && commentEnds && trimmed.length > 4) {
			// single-line comment: no state change
		}

		if (!inComment && trimmed.startsWith("## ")) {
			if (current) sections.push(current);
			current = { heading: trimmed.slice(3).trim(), body: "" };
		} else if (current) {
			current.body = current.body ? `${current.body}\n${line}` : line;
		}

		if (commentEnds && !commentStarts) inComment = false;
	}
	if (current) sections.push(current);
	return sections;
}

async function dirHasContent(dir: string): Promise<boolean> {
	let entries: string[];
	try {
		entries = await fs.readdir(dir);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw err;
	}
	return entries.length > 0;
}

async function dirContainsTemplates(dir: string): Promise<boolean> {
	try {
		const stat = await fs.stat(path.join(dir, "templates", "blank.md"));
		return stat.isFile();
	} catch {
		return false;
	}
}

async function resolveTemplatesDir(
	cwd: string,
	override?: string,
): Promise<string> {
	if (override) return override;

	const candidates: string[] = [];

	// 1. Relative to the current working directory (user-provided templates).
	candidates.push(path.resolve(cwd, "templates"));

	// 2. Walk up from the CLI module's own location to find the bundled
	//    templates/ directory at the monorepo root.
	const moduleDir = path.dirname(fileURLToPath(import.meta.url));
	let cursor = moduleDir;
	for (let i = 0; i < 6; i++) {
		candidates.push(path.resolve(cursor, "templates"));
		const parent = path.dirname(cursor);
		if (parent === cursor) break;
		cursor = parent;
	}

	// 3. Fall back to the cwd from which the process was launched.
	candidates.push(path.resolve(process.cwd(), "templates"));

	for (const candidate of candidates) {
		if (await dirContainsTemplates(path.dirname(candidate))) {
			return candidate;
		}
	}

	return candidates[0] ?? path.resolve(cwd, "templates");
}

export async function bibleInit(
	template: string | undefined,
	opts: BibleOpts = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);
	const bibleDir = biblePath(cwd);

	if (await dirHasContent(bibleDir)) {
		throw new Error(
			`bible/ already has content in ${bibleDir}. Remove it before re-initializing.`,
		);
	}

	await fs.mkdir(bibleDir, { recursive: true });

	const written: string[] = [];

	if (template === undefined) {
		for (const section of STANDARD_SECTIONS) {
			const file = sectionToFileName(section);
			const content = PLACEHOLDER_CONTENT[file] ?? "";
			await fs.writeFile(path.join(bibleDir, file), content, "utf-8");
			written.push(file);
		}
	} else {
		const templatesDir = await resolveTemplatesDir(cwd, opts.templatesDir);
		const tpl = await loadTemplate(template, templatesDir);

		const sections = splitTemplateSections(tpl.content);
		const fileToBody = new Map<string, string>();

		for (const section of sections) {
			const target = mapHeadingToFile(section.heading);
			const body = section.body.trim();
			const block = `## ${section.heading}${body ? `\n${body}` : ""}`;
			const existing = fileToBody.get(target);
			fileToBody.set(target, existing ? `${existing}\n\n${block}` : block);
		}

		for (const [file, body] of fileToBody) {
			await fs.writeFile(path.join(bibleDir, file), `${body}\n`, "utf-8");
			written.push(file);
		}

		await fs.writeFile(
			path.join(bibleDir, TEMPLATE_REFERENCE_FILE),
			`<!-- Original template: ${tpl.name} (${tpl.description}) -->\n${tpl.content}`,
			"utf-8",
		);
		written.push(TEMPLATE_REFERENCE_FILE);
	}

	stdout.write(`Initialized bible/ with:\n`);
	for (const file of written.sort()) {
		stdout.write(`  - ${file}\n`);
	}

	if (opts.agent) {
		await runBibleAgent(cwd, stdout);
	}
}

async function runBibleAgent(
	cwd: string,
	stdout: { write(chunk: string): void },
): Promise<void> {
	const { ProjectConfig, BibleAgent, createModel } = await import(
		"@essai/core"
	);
	const readline = await import("node:readline/promises");

	const config = await ProjectConfig.load(cwd);
	if (!config.llm.baseUrl || !config.llm.apiKey || !config.llm.model) {
		stdout.write("\nLLM not configured. Run `essai config set` first.\n");
		return;
	}

	const model = createModel(config.llm);
	const agent = new BibleAgent(config, model, cwd);

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	stdout.write("\nStarting AI-guided Bible creation...\n\n");

	await agent.run({
		onMessage: (msg) => stdout.write(`\n🤖 ${msg}\n\n`),
		onInput: () => rl.question("✍️  "),
		onSaved: (file, summary) =>
			stdout.write(`  ✓ ${summary} → bible/${file}\n`),
	});

	rl.close();
	stdout.write("\nBible creation complete!\n");
}

export async function bibleShow(opts: IoOpts = {}): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);
	const bibleDir = biblePath(cwd);

	let entries: string[];
	try {
		entries = await fs.readdir(bibleDir);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			stdout.write(`No bible/ directory found.\n`);
			return;
		}
		throw err;
	}

	const mdFiles = entries.filter((name) => name.endsWith(".md")).sort();
	if (mdFiles.length === 0) {
		stdout.write(`bible/ is empty.\n`);
		return;
	}

	stdout.write(`bible/\n`);
	for (const name of mdFiles) {
		const stat = await fs.stat(path.join(bibleDir, name));
		stdout.write(`  ${name}  (${stat.size} bytes)\n`);
	}
}

function hasRealContent(content: string): boolean {
	const stripped = content
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/[#\->\s]/g, "");
	return stripped.length > 0;
}

export async function bibleValidate(
	opts: IoOpts = {},
): Promise<ValidationResult> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);
	const bibleDir = biblePath(cwd);

	const missing: string[] = [];
	const empty: string[] = [];

	for (const section of STANDARD_SECTIONS) {
		const file = sectionToFileName(section);
		const filePath = path.join(bibleDir, file);
		let raw: string;
		try {
			raw = await fs.readFile(filePath, "utf-8");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				missing.push(file);
				continue;
			}
			throw err;
		}
		if (!hasRealContent(raw)) empty.push(file);
	}

	const ok = missing.length === 0 && empty.length === 0;

	if (ok) {
		stdout.write(`bible/ is complete: all standard sections present.\n`);
	} else {
		stdout.write(`bible/ has gaps:\n`);
		if (missing.length > 0) {
			stdout.write(`  missing:\n`);
			for (const file of missing) stdout.write(`    - ${file}\n`);
		}
		if (empty.length > 0) {
			stdout.write(`  empty:\n`);
			for (const file of empty) stdout.write(`    - ${file}\n`);
		}
	}

	return { missing, empty, ok };
}

function resolveEditor(opts: BibleEditOpts): string {
	if (opts.editor) return opts.editor;
	const fromEnv = process.env.EDITOR;
	if (fromEnv) return fromEnv;
	return DEFAULT_EDITOR;
}

async function defaultSpawn(cmd: string, args: string[]): Promise<void> {
	const { spawn } = await import("node:child_process");
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: "inherit" });
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} exited with code ${code}`));
		});
	});
}

export async function bibleEdit(
	file: string | undefined,
	opts: BibleEditOpts = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const bibleDir = biblePath(cwd);
	const editor = resolveEditor(opts);
	const spawn = opts.spawn ?? defaultSpawn;

	const target =
		file === undefined
			? bibleDir
			: `${path.join(bibleDir, file.endsWith(".md") ? file : `${file}.md`)}`;

	await spawn(editor, [target]);
}

async function defaultPrompt(question: string): Promise<string> {
	const readline = await import("node:readline/promises");
	const { stdin, stdout } = process;
	const rl = readline.createInterface({ input: stdin, output: stdout });
	try {
		const answer = await rl.question(question);
		return answer.trim();
	} finally {
		rl.close();
	}
}

export async function bibleAdd(
	section: string,
	opts: BibleAddOpts = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);
	const prompt = opts.prompt ?? defaultPrompt;
	const bibleDir = biblePath(cwd);
	await fs.mkdir(bibleDir, { recursive: true });

	const file = section.endsWith(".md") ? section : `${section}.md`;
	const filePath = path.join(bibleDir, file);

	let existing = "";
	try {
		existing = await fs.readFile(filePath, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
	}

	const isCharacters = file === "characters.md";
	const newEntry = await (async () => {
		if (isCharacters) {
			const name = await prompt("Character name: ");
			if (!name) return "";
			const fields: string[] = [];
			for (;;) {
				const field = await prompt("Field (e.g. age: 25), empty to finish: ");
				if (!field) break;
				fields.push(field);
			}
			return [`## ${name}`, ...fields.map((f) => `- ${f}`)].join("\n");
		}
		const item = await prompt(`New entry for ${section}: `);
		return item ? `- ${item}` : "";
	})();

	if (!newEntry) {
		stdout.write(`Nothing added.\n`);
		return;
	}

	const updated = existing
		? `${existing.replace(/\n?$/, "\n")}\n${newEntry}\n`
		: `${newEntry}\n`;
	await fs.writeFile(filePath, updated, "utf-8");
	stdout.write(`Added to ${file}.\n`);
}
