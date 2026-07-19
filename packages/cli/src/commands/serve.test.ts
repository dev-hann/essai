import { describe, expect, it } from "vitest";
import type { SpawnOptions } from "node:child_process";
import { DEFAULT_SERVE_PORT, resolveWebDir, serveCommand } from "./serve.js";

type SpawnCall = {
	cmd: string;
	args: string[];
	opts: SpawnOptions;
};

function recordingSpawn(calls: SpawnCall[]) {
	return (cmd: string, args: string[], opts: SpawnOptions) => {
		calls.push({ cmd, args, opts });
		const handlers: Record<string, ((...a: unknown[]) => unknown)[]> = {};
		return {
			on(event: string, cb: (...a: unknown[]) => unknown) {
				(handlers[event] ??= []).push(cb);
				return this;
			},
		};
	};
}

describe("serveCommand", () => {
	it("spawns npx next dev with the given port", async () => {
		const calls: SpawnCall[] = [];
		const stdout: string[] = [];
		await serveCommand(4321, {
			cwd: "/tmp/project",
			spawn: recordingSpawn(calls),
			stdout: { write: (s: string) => void stdout.push(s) },
		});

		expect(calls).toHaveLength(1);
		expect(calls[0].cmd).toMatch(/^npx(\.cmd)?$/);
		expect(calls[0].args).toEqual(["next", "dev", "-p", "4321"]);
		expect(calls[0].opts.env?.ESSAI_PROJECT_DIR).toBe("/tmp/project");
	});

	it("defaults to port 3000", async () => {
		expect(DEFAULT_SERVE_PORT).toBe(3000);
		const calls: SpawnCall[] = [];
		await serveCommand(DEFAULT_SERVE_PORT, {
			cwd: "/tmp/project",
			spawn: recordingSpawn(calls),
		});
		expect(calls[0].args).toEqual(["next", "dev", "-p", "3000"]);
	});

	it("sets ESSAI_PROJECT_DIR to cwd option", async () => {
		const calls: SpawnCall[] = [];
		await serveCommand(3000, {
			cwd: "/custom/project",
			spawn: recordingSpawn(calls),
		});
		expect(calls[0].opts.env?.ESSAI_PROJECT_DIR).toBe("/custom/project");
	});

	it("uses packages/web as the spawn cwd", async () => {
		const calls: SpawnCall[] = [];
		await serveCommand(3000, {
			cwd: "/tmp/project",
			spawn: recordingSpawn(calls),
		});
		expect(calls[0].opts.cwd).toBe(resolveWebDir());
	});

	it("rejects invalid ports", async () => {
		await expect(serveCommand(0, { spawn: recordingSpawn([]) })).rejects.toThrow(
			/Invalid port/,
		);
		await expect(
			serveCommand(70000, { spawn: recordingSpawn([]) }),
		).rejects.toThrow(/Invalid port/);
	});
});
