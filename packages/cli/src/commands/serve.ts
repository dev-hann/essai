import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

export interface ServeOptions {
	cwd?: string;
	/** Port for the Next.js dev/start server. Defaults to 7331. */
	port?: number;
	/** dev (default) or start (production). */
	mode?: "dev" | "start";
	/**
	 * Injection seam for tests: a function that spawns a child process and
	 * returns it. The default uses node:child_process.spawn with stdio inherited.
	 */
	spawnFn?: (
		cmd: string,
		args: string[],
		opts: {
			cwd: string;
			env: NodeJS.ProcessEnv;
			stdio: "inherit";
		},
	) => Pick<ChildProcess, "on">;
}

const DEFAULT_PORT = 7331;
const CURRENT_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the absolute path to the @essai/web package directory.
 *
 * The CLI ships with the web package as a workspace dependency, so we look it
 * up via Node module resolution. We fall back to a relative path from this
 * file (which lives in packages/cli/src/commands/) in case the workspace
 * hasn't been installed yet (e.g. fresh clone before pnpm install).
 */
export function resolveWebDir(): string {
	try {
		const pkgJsonPath = requireFromHere.resolve("@essai/web/package.json");
		return path.dirname(pkgJsonPath);
	} catch {
		// Fallback: ../web from this file (which lives in packages/cli/src/commands/)
		return path.resolve(CURRENT_FILE_DIR, "..", "..", "..", "web");
	}
}

/**
 * Resolve the path to the `next` CLI binary.
 */
function resolveNextBinary(webDir: string): string {
	const localBin = path.join(webDir, "node_modules", ".bin", "next");
	if (existsSync(localBin)) return localBin;
	try {
		return requireFromHere.resolve("next/dist/bin/next");
	} catch {
		// Last resort: hope `next` is on PATH
		return "next";
	}
}

/**
 * Build the argv passed to the `next` binary.
 */
export function buildNextArgs(opts: {
	port?: number;
	mode?: "dev" | "start";
}): string[] {
	const port = opts.port ?? DEFAULT_PORT;
	const mode = opts.mode ?? "dev";
	return [mode, "--port", String(port)];
}

export async function serveCommand(opts: ServeOptions = {}): Promise<void> {
	const port = opts.port ?? DEFAULT_PORT;
	const mode = opts.mode ?? "dev";
	const webDir = resolveWebDir();
	const args = buildNextArgs({ port, mode });
	const nextBin = resolveNextBinary(webDir);

	const env: NodeJS.ProcessEnv = {
		...process.env,
		// Ensure the web process can find @essai/core's compiled output
		NODE_OPTIONS: process.env.NODE_OPTIONS ?? "",
	};

	const spawnFn =
		opts.spawnFn ??
		((cmd: string, argv: string[], o) =>
			spawn(cmd, argv, o) as unknown as Pick<ChildProcess, "on">);

	const child = spawnFn(nextBin, args, {
		cwd: webDir,
		env,
		stdio: "inherit",
	});

	const exitCode: number | null = await new Promise((resolve) => {
		child.on("exit", (code) => resolve(code ?? 0));
		child.on("error", (err) => {
			process.stderr.write(`essai serve failed: ${err.message}\n`);
			resolve(1);
		});
	});

	if (exitCode !== 0) {
		throw new Error(`next ${mode} exited with code ${exitCode}`);
	}
}

export const SERVE_DEFAULT_PORT = DEFAULT_PORT;
