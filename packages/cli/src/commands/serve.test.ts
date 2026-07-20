import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildNextArgs, resolveWebDir, serveCommand } from "./serve.js";

describe("serve command", () => {
	describe("resolveWebDir", () => {
		it("returns an absolute path ending in packages/web", () => {
			const dir = resolveWebDir();
			expect(dir.endsWith("packages/web")).toBe(true);
		});
	});

	describe("buildNextArgs", () => {
		it("uses dev mode and the given port", () => {
			const args = buildNextArgs({ port: 7331, mode: "dev" });
			expect(args).toEqual(["dev", "--port", "7331"]);
		});

		it("uses start mode when mode=start", () => {
			const args = buildNextArgs({ port: 8000, mode: "start" });
			expect(args).toEqual(["start", "--port", "8000"]);
		});

		it("falls back to 7331 when port is undefined", () => {
			const args = buildNextArgs({ port: undefined, mode: "dev" });
			expect(args).toEqual(["dev", "--port", "7331"]);
		});
	});

	describe("serveCommand project dir propagation", () => {
		it("passes ESSAI_PROJECT_DIR to the spawned process resolved from opts.cwd", async () => {
			let captured: { cwd?: string; env?: NodeJS.ProcessEnv } = {};
			await serveCommand({
				cwd: "/tmp/my-novel",
				spawnFn: (_cmd, _args, opts) => {
					captured = { cwd: opts.cwd, env: opts.env };
					const fakeChild = {
						on(event: string, cb: (...a: unknown[]) => void) {
							if (event === "exit") {
								setImmediate(() => cb(0));
							}
							return fakeChild;
						},
					};
					return fakeChild as never;
				},
			});

			expect(captured.env?.ESSAI_PROJECT_DIR).toBe(
				path.resolve("/tmp/my-novel"),
			);
		});

		it("falls back to process.cwd() when cwd option is omitted", async () => {
			let capturedEnv: NodeJS.ProcessEnv = {};
			await serveCommand({
				spawnFn: (_cmd, _args, opts) => {
					capturedEnv = opts.env;
					const fakeChild = {
						on(event: string, cb: (...a: unknown[]) => void) {
							if (event === "exit") {
								setImmediate(() => cb(0));
							}
							return fakeChild;
						},
					};
					return fakeChild as never;
				},
			});

			expect(capturedEnv.ESSAI_PROJECT_DIR).toBe(process.cwd());
		});
	});
});
