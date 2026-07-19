import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getProjectDir } from "../../../lib/projectDir";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
	try {
		const dir = getProjectDir();
		const chaptersDir = path.join(dir, "chapters");
		let entries: string[] = [];
		try {
			entries = await fs.readdir(chaptersDir);
		} catch {
			entries = [];
		}

		const sorted = entries
			.filter((n) => /^\d+\.md$/.test(n))
			.sort((a, b) => Number(a) - Number(b));

		const parts: string[] = [];
		for (const name of sorted) {
			const content = await fs.readFile(path.join(chaptersDir, name), "utf-8");
			const number = Number(name.slice(0, -3));
			parts.push(`# ${number}화\n\n${content}`);
		}

		const exportsDir = path.join(dir, "exports");
		await fs.mkdir(exportsDir, { recursive: true });
		const file = path.join(exportsDir, "full.md");
		await fs.writeFile(file, parts.join("\n\n---\n\n"), "utf-8");

		return NextResponse.json({ path: file });
	} catch (err) {
		const message = err instanceof Error ? err.message : "export failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
