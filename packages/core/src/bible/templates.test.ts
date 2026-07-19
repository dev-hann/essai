import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	isSupportedTemplateName,
	listTemplates,
	loadTemplate,
	parseTemplateFrontmatter,
	TEMPLATE_NAMES,
} from "./templates.js";

async function writeTemplate(
	dir: string,
	name: string,
	content: string,
): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, `${name}.md`), content, "utf-8");
}

const ROMANCE_TEMPLATE = `# Bible Template: Romance

---
agent:
  template: romance
  sections: [characters, relationships, conflict, emotion, chapters, style, tone, constraints]
---

Body content here.
`;

const BLANK_TEMPLATE = `# Bible Template: Blank

---
agent:
  template: blank
  sections: [characters, relationships, emotion, chapters, style, tone, constraints]
---

Blank body.
`;

describe("TEMPLATE_NAMES", () => {
	it("includes the five templates defined at the repo root", () => {
		expect(TEMPLATE_NAMES).toContain("blank");
		expect(TEMPLATE_NAMES).toContain("romance");
		expect(TEMPLATE_NAMES).toContain("fantasy");
		expect(TEMPLATE_NAMES).toContain("mystery");
		expect(TEMPLATE_NAMES).toContain("scifi");
	});
});

describe("isSupportedTemplateName", () => {
	it("returns true for each known template name", () => {
		for (const name of TEMPLATE_NAMES) {
			expect(isSupportedTemplateName(name)).toBe(true);
		}
	});

	it("returns false for an unknown name", () => {
		expect(isSupportedTemplateName("horror")).toBe(false);
	});
});

describe("parseTemplateFrontmatter", () => {
	it("extracts the template name from the agent block", () => {
		const parsed = parseTemplateFrontmatter(ROMANCE_TEMPLATE);
		expect(parsed.template).toBe("romance");
	});

	it("extracts the sections list as an array", () => {
		const parsed = parseTemplateFrontmatter(ROMANCE_TEMPLATE);
		expect(parsed.sections).toContain("characters");
		expect(parsed.sections).toContain("conflict");
		expect(parsed.sections).toContain("constraints");
	});

	it("extracts the description from the first H1", () => {
		const parsed = parseTemplateFrontmatter(ROMANCE_TEMPLATE);
		expect(parsed.description.toLowerCase()).toContain("romance");
	});

	it("returns an empty sections array when the frontmatter is missing", () => {
		const parsed = parseTemplateFrontmatter("# Just a heading\n\nbody");
		expect(parsed.sections).toEqual([]);
		expect(parsed.template).toBe("");
	});
});

describe("loadTemplate", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "essai-tpls-"));
	});

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("reads <name>.md and returns the parsed template", async () => {
		await writeTemplate(dir, "romance", ROMANCE_TEMPLATE);

		const template = await loadTemplate("romance", dir);

		expect(template.name).toBe("romance");
		expect(template.sections).toContain("conflict");
		expect(template.content).toBe(ROMANCE_TEMPLATE);
		expect(template.description.toLowerCase()).toContain("romance");
	});

	it("throws when the template file does not exist", async () => {
		await expect(loadTemplate("nope", dir)).rejects.toThrow();
	});

	it("throws when the template name is not supported", async () => {
		await writeTemplate(dir, "horror", "# horror\n");
		await expect(loadTemplate("horror", dir)).rejects.toThrow(/support/i);
	});
});

describe("listTemplates", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "essai-tpls-"));
	});

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("returns all templates in the directory sorted by name", async () => {
		await writeTemplate(dir, "romance", ROMANCE_TEMPLATE);
		await writeTemplate(dir, "blank", BLANK_TEMPLATE);

		const templates = await listTemplates(dir);
		const names = templates.map((t) => t.name);

		expect(names).toEqual(["blank", "romance"]);
	});

	it("skips files whose names are not supported templates", async () => {
		await writeTemplate(dir, "romance", ROMANCE_TEMPLATE);
		await writeTemplate(dir, "draft", "# draft\n");

		const templates = await listTemplates(dir);
		expect(templates.map((t) => t.name)).toEqual(["romance"]);
	});

	it("returns an empty array when the directory does not exist", async () => {
		const templates = await listTemplates(path.join(dir, "missing"));
		expect(templates).toEqual([]);
	});
});
