import { describe, expect, it } from "vitest";
import {
	buildNextArgs,
	resolveWebDir,
} from "./serve.js";

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
});
