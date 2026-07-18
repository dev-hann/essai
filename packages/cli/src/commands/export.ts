import { promises as fs } from "node:fs";
import path from "node:path";
import { type IoOpts, listChapterFiles, resolveStdout } from "./_shared.js";

export type ExportFormat = "md" | "txt";

export interface ExportOptions extends IoOpts {
	format?: ExportFormat;
}

export interface ChapterSource {
	name: string;
	content: string;
}

const DEFAULT_FORMAT: ExportFormat = "md";
const EXPORT_DIR = "exports";
const EXPORT_BASENAME = "full";

function extensionFor(format: ExportFormat): string {
	return format === "txt" ? "txt" : "md";
}

function chapterNumberFromName(name: string): number {
	const match = name.match(/(\d+)/);
	return match ? Number(match[1] ?? 0) : 0;
}

function headerFor(chapter: number, format: ExportFormat): string {
	if (format === "txt") return "";
	return `# Chapter ${chapter}\n\n`;
}

export function buildExportContent(
	files: ChapterSource[],
	format: ExportFormat,
): string {
	const sorted = [...files].sort((a, b) => {
		const ai = chapterNumberFromName(a.name);
		const bi = chapterNumberFromName(b.name);
		if (ai !== bi) return ai - bi;
		return a.name.localeCompare(b.name);
	});

	const blocks = sorted.map((file) => {
		const header = headerFor(chapterNumberFromName(file.name), format);
		return `${header}${file.content}`;
	});

	return blocks.join("\n\n");
}

export async function exportCommand(opts: ExportOptions = {}): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);
	const format: ExportFormat = opts.format ?? DEFAULT_FORMAT;

	const names = await listChapterFiles(cwd);
	if (names.length === 0) {
		throw new Error("No chapters found. Write a chapter before exporting.");
	}

	const sources: ChapterSource[] = [];
	for (const name of names) {
		const content = await fs.readFile(
			path.join(cwd, "chapters", name),
			"utf-8",
		);
		sources.push({ name, content });
	}

	const body = buildExportContent(sources, format);
	const exportDir = path.join(cwd, EXPORT_DIR);
	await fs.mkdir(exportDir, { recursive: true });
	const outFile = path.join(
		exportDir,
		`${EXPORT_BASENAME}.${extensionFor(format)}`,
	);
	await fs.writeFile(outFile, `${body}\n`, "utf-8");

	stdout.write(
		`Exported ${sources.length} chapters to ${path.relative(cwd, outFile)}\n`,
	);
}
