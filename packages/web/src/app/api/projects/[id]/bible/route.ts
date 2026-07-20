import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { BIBLE_FILES } from "@/lib/chapters.js";
import {
	ProjectNotFoundError,
	resolveProjectDir,
} from "@/lib/projectResolver.js";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
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

	const bibleDir = path.join(cwd, "bible");

	const files = await Promise.all(
		BIBLE_FILES.map(async (filename) => {
			const section = filename.slice(0, -".md".length);
			try {
				const content = await fs.readFile(
					path.join(bibleDir, filename),
					"utf-8",
				);
				return { section, filename, content };
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === "ENOENT") {
					return { section, filename, content: "" };
				}
				throw err;
			}
		}),
	);

	return NextResponse.json({ files });
}
