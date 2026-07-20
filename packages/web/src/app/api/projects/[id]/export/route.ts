import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { listChapterFiles } from "@/lib/chapters.js";
import {
	ProjectNotFoundError,
	resolveProjectDir,
} from "@/lib/projectResolver.js";

export const dynamic = "force-dynamic";

const EXPORT_DIR = "exports";
const EXPORT_BASENAME = "full";

type ExportFormat = "md" | "txt";

interface ExportBody {
	format?: ExportFormat;
}

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

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
	const { id } = await params;
	let cwd: string;
	try {
		cwd = await resolveProjectDir(id);
	} catch (err) {
		if (err instanceof ProjectNotFoundError) {
			return NextResponse.json(
				{ error: `Unknown project: ${id}` },
				{ status: 404 },
			);
		}
		throw err;
	}

	let body: ExportBody = {};
	try {
		body = (await req.json()) as ExportBody;
	} catch {
		// empty body is OK — default format
	}
	const format: ExportFormat = body.format === "txt" ? "txt" : "md";

	const names = await listChapterFiles(cwd);
	if (names.length === 0) {
		return NextResponse.json(
			{ error: "내보낼 챕터가 없습니다" },
			{ status: 400 },
		);
	}

	const sources: Array<{ name: string; content: string }> = [];
	for (const name of names) {
		try {
			const content = await fs.readFile(
				path.join(cwd, "chapters", name),
				"utf-8",
			);
			sources.push({ name, content });
		} catch {
			// skip unreadable
		}
	}

	const sorted = [...sources].sort((a, b) => {
		const ai = chapterNumberFromName(a.name);
		const bi = chapterNumberFromName(b.name);
		if (ai !== bi) return ai - bi;
		return a.name.localeCompare(b.name);
	});
	const blocks = sorted.map(
		(file) =>
			`${headerFor(chapterNumberFromName(file.name), format)}${file.content}`,
	);
	const bodyText = blocks.join("\n\n");

	const exportDir = path.join(cwd, EXPORT_DIR);
	await fs.mkdir(exportDir, { recursive: true });
	const outFile = path.join(
		exportDir,
		`${EXPORT_BASENAME}.${extensionFor(format)}`,
	);
	await fs.writeFile(outFile, `${bodyText}\n`, "utf-8");

	return NextResponse.json({
		format,
		path: path.relative(cwd, outFile),
		chapterCount: sorted.length,
	});
}
