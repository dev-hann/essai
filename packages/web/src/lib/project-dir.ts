import path from "node:path";

/**
 * Resolve the essai project directory that the web UI operates on.
 *
 * Order of precedence:
 *   1. ESSAI_PROJECT_DIR env var (absolute or relative to cwd)
 *   2. process.cwd()
 */
export function getProjectDir(): string {
	const fromEnv = process.env.ESSAI_PROJECT_DIR;
	if (fromEnv?.trim()) {
		return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(fromEnv);
	}
	return process.cwd();
}
