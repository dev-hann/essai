import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { BIBLE_FILES } from "@/lib/chapters.js";
import { getProjectDir } from "@/lib/project-dir.js";

export const dynamic = "force-dynamic";

export async function GET() {
	const cwd = getProjectDir();
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
