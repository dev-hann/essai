export function getProjectDir(): string {
	return process.env.ESSAI_PROJECT_DIR || process.cwd();
}
