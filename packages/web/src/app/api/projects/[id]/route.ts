import { GlobalConfig } from "@essai/core";
import { NextResponse } from "next/server";
import {
	ProjectNotFoundError,
	resolveProjectDir,
} from "@/lib/projectResolver.js";
import { loadProjectStats } from "@/lib/projectStats.js";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
	const { id } = await params;

	let projectDir: string;
	try {
		projectDir = await resolveProjectDir(id);
	} catch (err) {
		if (err instanceof ProjectNotFoundError) {
			return NextResponse.json(
				{ error: `Unknown project: ${id}` },
				{ status: 404 },
			);
		}
		throw err;
	}

	const global = await GlobalConfig.load();
	const entry = global.getProject(id);
	const stats = await loadProjectStats(projectDir);

	return NextResponse.json({
		id,
		name: entry?.name ?? id,
		path: projectDir,
		lastVisited: entry?.lastVisited ?? null,
		stats,
	});
}
