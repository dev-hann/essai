import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { getProjectDir } from "@/lib/project-dir.js";

describe("getProjectDir", () => {
	const originalEnv = process.env.ESSAI_PROJECT_DIR;

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.ESSAI_PROJECT_DIR;
		} else {
			process.env.ESSAI_PROJECT_DIR = originalEnv;
		}
	});

	it("returns the env value when set to an absolute path", () => {
		process.env.ESSAI_PROJECT_DIR = "/tmp/some-project";
		expect(getProjectDir()).toBe("/tmp/some-project");
	});

	it("resolves a relative env value against process.cwd()", () => {
		process.env.ESSAI_PROJECT_DIR = "relative/path";
		const expected = path.resolve(process.cwd(), "relative/path");
		expect(getProjectDir()).toBe(expected);
	});

	it("falls back to process.cwd() when env is unset", () => {
		delete process.env.ESSAI_PROJECT_DIR;
		expect(getProjectDir()).toBe(process.cwd());
	});

	it("falls back to process.cwd() when env is blank", () => {
		process.env.ESSAI_PROJECT_DIR = "   ";
		expect(getProjectDir()).toBe(process.cwd());
	});
});
