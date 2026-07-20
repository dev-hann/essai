import { GlobalConfig } from "@essai/core";
import { NextResponse } from "next/server";
import { loadProjectStats } from "@/lib/projectStats.js";

export const dynamic = "force-dynamic";

export async function GET() {
	const global = await GlobalConfig.load();
	const entries = global.listProjects();

	const projects = await Promise.all(
		entries.map(async (entry) => {
			const stats = await loadProjectStats(entry.path).catch(() => ({
				writtenCount: 0,
				plannedCount: 0,
				totalCharacters: 0,
			}));
			return {
				id: entry.id,
				name: entry.name,
				path: entry.path,
				lastVisited: entry.lastVisited ?? null,
				writtenCount: stats.writtenCount,
				plannedCount: stats.plannedCount,
				totalCharacters: stats.totalCharacters,
			};
		}),
	);

	projects.sort((a, b) => {
		const at = a.lastVisited ? Date.parse(a.lastVisited) : 0;
		const bt = b.lastVisited ? Date.parse(b.lastVisited) : 0;
		if (at !== bt) return bt - at;
		return a.name.localeCompare(b.name);
	});

	return NextResponse.json({ projects });
}
