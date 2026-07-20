import { promises as fs } from "node:fs";
import path from "node:path";
import { BIBLE_FILES } from "@/lib/chapters.js";
import { resolveProjectDir } from "@/lib/projectResolver.js";
import { BibleClient } from "@/components/BibleClient.js";

export const dynamic = "force-dynamic";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function BiblePage({ params }: PageProps) {
	const { id } = await params;
	const cwd = await resolveProjectDir(id);
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

	return <BibleClient projectId={id} files={files} />;
}
