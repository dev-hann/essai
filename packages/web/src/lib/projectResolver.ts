import { GlobalConfig } from "@essai/core";
import { getProjectDir } from "@/lib/project-dir.js";

/**
 * Resolve a project id (from the URL) to its on-disk directory by looking it
 * up in GlobalConfig. Throws if the id is unknown.
 */
export async function resolveProjectDir(id: string): Promise<string> {
	const global = await GlobalConfig.load();
	const project = global.getProject(id);
	if (!project) {
		throw new ProjectNotFoundError(id);
	}
	return project.path;
}

/**
 * Fallback directory used by the legacy API routes that still rely on the
 * ESSAI_PROJECT_DIR env var (or process.cwd()).
 */
export function fallbackProjectDir(): string {
	return getProjectDir();
}

export class ProjectNotFoundError extends Error {
	constructor(public readonly projectId: string) {
		super(`Unknown project: ${projectId}`);
		this.name = "ProjectNotFoundError";
	}
}
