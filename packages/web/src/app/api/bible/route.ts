import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getProjectDir } from "../../../lib/projectDir";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const bibleDir = path.join(getProjectDir(), "bible");
		let entries: string[] = [];
		try {
			entries = await fs.readdir(bibleDir);
		} catch {
			return NextResponse.json({});
		}

		const result: Record<string, string> = {};
		for (const name of entries.filter((n) => n.endsWith(".md")).sort()) {
			const file = path.join(bibleDir, name);
			result[name] = await fs.readFile(file, "utf-8");
		}
		return NextResponse.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "load failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
