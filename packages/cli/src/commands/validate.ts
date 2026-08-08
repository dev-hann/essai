import { promises as fs } from "node:fs";
import path from "node:path";
import {
	loadWorld,
	ProjectConfig,
	StaticValidator,
	type ValidationSeverity,
} from "@essai/core";
import { type IoOpts, resolveStdout } from "./_shared.js";

export interface ValidateOptions extends IoOpts {
	/** Disable specific rules by id. */
	disable?: string[];
}

const SEVERITY_WEIGHT: Record<ValidationSeverity, number> = {
	error: 3,
	warning: 2,
	info: 1,
};

const PAD_WIDTH = 3;

export async function validateCommand(
	chapter: number,
	opts: ValidateOptions = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);

	const file = path.join(
		cwd,
		"chapters",
		`${chapter.toString().padStart(PAD_WIDTH, "0")}.md`,
	);
	let content: string;
	try {
		content = await fs.readFile(file, "utf-8");
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`Chapter ${chapter} not found at ${path.relative(cwd, file)}`,
			);
		}
		throw err;
	}

	const world = await loadWorld(path.join(cwd, "bible"));
	// Load project config purely to pick up the language code so language-
	// specific surface rules (Korean register, English em-dash) fire
	// appropriately. ProjectConfig.load returns defaults when essai.json
	// is missing, so this never throws for the validator path.
	const config = await ProjectConfig.load(cwd).catch(() => null);
	const validator = new StaticValidator({
		...(config ? { language: config.language } : {}),
		...(opts.disable && opts.disable.length > 0
			? { disable: opts.disable }
			: {}),
	});
	const findings = validator.validate(content, world);

	if (findings.length === 0) {
		stdout.write(`✓ Chapter ${chapter}: no continuity issues detected.\n`);
		return;
	}

	const counts = countBySeverity(findings);
	stdout.write(
		`Chapter ${chapter}: ${findings.length} finding(s) — ${counts.error} error, ${counts.warning} warning, ${counts.info} info.\n\n`,
	);

	const ordered = [...findings].sort(
		(a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
	);
	for (const finding of ordered) {
		const label = labelFor(finding.severity);
		stdout.write(
			`${label} [${finding.rule}] ${finding.message}${finding.excerpt ? `\n    excerpt: ${finding.excerpt}` : ""}\n`,
		);
	}
}

function countBySeverity(
	findings: { severity: ValidationSeverity }[],
): Record<ValidationSeverity, number> {
	const counts: Record<ValidationSeverity, number> = {
		error: 0,
		warning: 0,
		info: 0,
	};
	for (const f of findings) counts[f.severity]++;
	return counts;
}

function labelFor(severity: ValidationSeverity): string {
	switch (severity) {
		case "error":
			return "✗";
		case "warning":
			return "⚠";
		case "info":
			return "ℹ";
	}
}
