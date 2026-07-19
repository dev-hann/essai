import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ServeOpts {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	webDir?: string;
	spawn?: (
		cmd: string,
		args: string[],
		opts: SpawnOptions,
	) => { on(event: "error", cb: (err: Error) => void): unknown };
	stdout?: { write(chunk: string): void };
}

export const DEFAULT_SERVE_PORT = 3000;

export function resolveWebDir(from?: string): string {
	const base = from ?? path.dirname(fileURLToPath(import.meta.url));
	return path.resolve(base, "..", "..", "..", "web");
}

async function defaultSpawn(
	cmd: string,
	args: string[],
	opts: SpawnOptions,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = nodeSpawn(cmd, args, opts);
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0 || code === null) resolve();
			else reject(new Error(`${cmd} exited with code ${code}`));
		});
	});
}

export async function serveCommand(
	port: number = DEFAULT_SERVE_PORT,
	opts: ServeOpts = {},
): Promise<void> {
	if (!Number.isFinite(port) || port < 1 || port > 65535) {
		throw new Error(
			`Invalid port: ${port}. Use an integer between 1 and 65535.`,
		);
	}

	const projectDir = opts.cwd ?? process.cwd();
	const webDir = opts.webDir ?? resolveWebDir();
	const stdout = opts.stdout ?? process.stdout;

	const env: NodeJS.ProcessEnv = {
		...(opts.env ?? process.env),
		ESSAI_PROJECT_DIR: projectDir,
	};

	stdout.write(
		`Starting essai web UI on port ${port} (project: ${projectDir})\n`,
	);

	const isWin = process.platform === "win32";
	const cmd = isWin ? "npx.cmd" : "npx";
	const args = ["next", "dev", "-p", String(port)];

	const spawn = opts.spawn ?? defaultSpawn;
	await spawn(cmd, args, {
		cwd: webDir,
		env,
		stdio: "inherit",
		shell: isWin,
	});
}
