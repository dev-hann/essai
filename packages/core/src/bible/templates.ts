import { promises as fs } from "node:fs";
import path from "node:path";

export const TEMPLATE_NAMES = [
	"blank",
	"romance",
	"fantasy",
	"mystery",
	"scifi",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

const SUPPORTED = new Set<string>(TEMPLATE_NAMES);
const TEMPLATE_SUFFIX = ".md";

export interface ParsedTemplate {
	template: string;
	description: string;
	sections: string[];
}

export interface Template extends ParsedTemplate {
	name: string;
	content: string;
}

export function isSupportedTemplateName(name: string): boolean {
	return SUPPORTED.has(name);
}

const FRONTMATTER_RE = /---\s*\n([\s\S]*?)\n---/;
const TEMPLATE_FIELD_RE = /template:\s*(\S+)/;
const SECTIONS_INLINE_RE = /sections:\s*\[([^\]]*)\]/;
const SECTIONS_BLOCK_RE = /sections:\s*\n([\s\S]*?)(?=\n\S+:|\n---|\n#|$)/;
const H1_RE = /^#\s+(.*)$/;

function parseSectionsLine(line: string): string[] {
	const inline = line.match(SECTIONS_INLINE_RE);
	if (inline) {
		const raw = inline[1] ?? "";
		return raw
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}
	return [];
}

function parseSectionsBlock(body: string): string[] {
	const lines: string[] = [];
	for (const rawLine of body.split(/\r?\n/)) {
		const trimmed = rawLine.trim();
		if (!trimmed.startsWith("-")) continue;
		lines.push(trimmed.replace(/^-\s*/, "").trim());
	}
	return lines;
}

export function parseTemplateFrontmatter(content: string): ParsedTemplate {
	const match = content.match(FRONTMATTER_RE);
	const frontmatter = match ? (match[1] ?? "") : "";

	const templateField = frontmatter.match(TEMPLATE_FIELD_RE);
	const template = templateField ? (templateField[1] ?? "").trim() : "";

	let sections: string[] = [];
	const inline = parseSectionsLine(frontmatter);
	if (inline.length > 0) {
		sections = inline;
	} else {
		const block = frontmatter.match(SECTIONS_BLOCK_RE);
		if (block) sections = parseSectionsBlock(block[1] ?? "");
	}

	let description = "";
	for (const rawLine of content.split(/\r?\n/)) {
		const h1 = rawLine.match(H1_RE);
		if (h1) {
			description = (h1[1] ?? "").trim();
			break;
		}
	}

	return { template, description, sections };
}

export async function loadTemplate(
	name: string,
	templatesDir: string,
): Promise<Template> {
	if (!isSupportedTemplateName(name)) {
		throw new Error(
			`Unsupported template "${name}". Supported: ${TEMPLATE_NAMES.join(", ")}.`,
		);
	}
	const file = path.join(templatesDir, `${name}${TEMPLATE_SUFFIX}`);
	const content = await fs.readFile(file, "utf-8");
	const parsed = parseTemplateFrontmatter(content);
	return {
		name,
		content,
		template: parsed.template || name,
		description: parsed.description,
		sections: parsed.sections,
	};
}

export async function listTemplates(templatesDir: string): Promise<Template[]> {
	let entries: string[];
	try {
		entries = await fs.readdir(templatesDir);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}

	const supported = entries
		.filter(
			(name) =>
				name.endsWith(TEMPLATE_SUFFIX) &&
				isSupportedTemplateName(name.slice(0, -TEMPLATE_SUFFIX.length)),
		)
		.sort();

	const templates: Template[] = [];
	for (const fileName of supported) {
		const stem = fileName.slice(0, -TEMPLATE_SUFFIX.length);
		const content = await fs.readFile(
			path.join(templatesDir, fileName),
			"utf-8",
		);
		const parsed = parseTemplateFrontmatter(content);
		templates.push({
			name: stem,
			content,
			template: parsed.template || stem,
			description: parsed.description,
			sections: parsed.sections,
		});
	}
	return templates;
}
