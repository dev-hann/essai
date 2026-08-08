import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `essai tui` — launch the Ink-based terminal UI.
 *
 * Spawns the standalone `@essai/tui` entrypoint as a child process so the
 * React/Ink render loop owns the terminal directly. We don't import it
 * in-process because Ink needs raw stdin/stdout that Commander's wrapper
 * would otherwise interfere with.
 */

export interface TuiOptions {
	cwd?: string;
}

export async function tuiCommand(_opts: TuiOptions = {}): Promise<void> {
	const here = path.dirname(fileURLToPath(import.meta.url));
	// From packages/cli/dist/commands/serve.js → packages/tui/dist/index.js
	const tuiEntry = path.resolve(
		here,
		"..",
		"..",
		"..",
		"tui",
		"dist",
		"index.js",
	);
	const child = spawn(process.execPath, [tuiEntry], {
		stdio: "inherit",
	});
	await new Promise<void>((resolve, reject) => {
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`essai-tui exited with code ${code ?? "null"}`));
		});
	});
}
