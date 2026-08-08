import { promises as fs } from "node:fs";
import path from "node:path";
import {
	type AuditDimensionId,
	ContinuityAuditor,
	loadBible,
	loadWorld,
	MemoryStore,
	ProjectConfig,
	type ValidationSeverity,
} from "@essai/core";
import { type IoOpts, resolveStdout } from "./_shared.js";

export interface AuditOptions extends IoOpts {
	/** Restrict audit to specific dimensions. */
	only?: AuditDimensionId[];
}

const SEVERITY_WEIGHT: Record<ValidationSeverity, number> = {
	error: 3,
	warning: 2,
	info: 1,
};

const PAD_WIDTH = 3;
const MEMORY_RECENT_COUNT = 3;

export async function auditCommand(
	chapter: number,
	opts: AuditOptions = {},
): Promise<void> {
	const cwd = opts.cwd ?? process.cwd();
	const stdout = resolveStdout(opts);

	const config = await ProjectConfig.load(cwd);
	if (!config.llm.baseUrl || !config.llm.apiKey || !config.llm.model) {
		throw new Error(
			"Audit needs LLM access. Set llm.baseUrl / llm.apiKey / llm.model first.",
		);
	}

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

	const [bible, world] = await Promise.all([
		loadBible(path.join(cwd, "bible")),
		loadWorld(path.join(cwd, "bible")),
	]);
	const memoryStore = new MemoryStore();
	const memory = await memoryStore.loadRecent(
		path.join(cwd, "memory"),
		MEMORY_RECENT_COUNT,
	);

	stdout.write(
		`Auditing chapter ${chapter} across ${opts.only?.length ?? 8} dimension(s)…\n`,
	);
	const auditor = new ContinuityAuditor(config);
	const findings = await auditor.audit(chapter, content, bible, memory, world, {
		...(opts.only && opts.only.length > 0 ? { only: opts.only } : {}),
	});

	if (findings.length === 0) {
		stdout.write(`✓ Chapter ${chapter}: audit returned no findings.\n`);
		return;
	}

	const counts = countBySeverity(findings);
	stdout.write(
		`\nChapter ${chapter}: ${findings.length} finding(s) — ${counts.error} error, ${counts.warning} warning, ${counts.info} info.\n\n`,
	);

	const ordered = [...findings].sort(
		(a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
	);
	for (const finding of ordered) {
		const label = labelFor(finding.severity);
		stdout.write(`${label} [${finding.rule}] ${finding.message}\n`);
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
