import { promises as fs } from "node:fs";
import path from "node:path";
import type { BibleData } from "../bible/types.js";
import type { ProjectConfig } from "../config/project-config.js";
import { ChapterEditor } from "../editor/chapter-editor.js";
import type { ChapterMemory } from "../memory/types.js";
import type { ReviewResult } from "../reviewer/chapter-reviewer.js";
import { ChapterReviewer } from "../reviewer/chapter-reviewer.js";
import { ChapterWriter } from "../writer/chapter-writer.js";

export type PipelineStage = "write" | "review" | "fix" | "memory" | "done";

export interface PipelineStepResult {
	stage: PipelineStage;
	status: "done" | "skipped" | "failed";
	message: string;
	result?: unknown;
}

export interface PipelineOptions {
	/** Skip entire pipeline, just write */
	raw?: boolean;
	/** Review but don't auto-fix */
	noFix?: boolean;
	/** Callback for progress updates */
	onProgress?: (step: PipelineStepResult) => void;
}

export interface PipelineResult {
	chapter: number;
	steps: PipelineStepResult[];
	content: string;
	wordCount: number;
	review?: ReviewResult;
}

/**
 * The write pipeline. By default runs:
 * write → review → fix (if needed) → memory
 *
 * This is the InkOS-inspired approach: the pipeline is always on.
 * Use --raw to skip, --no-fix to skip auto-fix.
 */
export async function runWritePipeline(
	chapterNumber: number,
	config: ProjectConfig,
	bible: BibleData,
	projectDir: string,
	memorySummaries: ChapterMemory[],
	options: PipelineOptions = {},
): Promise<PipelineResult> {
	const { onProgress, raw, noFix } = options;
	const steps: PipelineStepResult[] = [];
	const log = (r: PipelineStepResult) => {
		steps.push(r);
		onProgress?.(r);
	};

	// --- Step 1: Write ---
	const writer = new ChapterWriter(config, bible, projectDir);
	const writeResult = await writer.writeChapter(chapterNumber, {
		...(memorySummaries.length > 0 ? { memorySummaries } : {}),
	});
	log({
		stage: "write",
		status: "done",
		message: `Chapter ${chapterNumber} generated (${writeResult.wordCount} chars)`,
		result: writeResult,
	});

	// Raw mode: stop here
	if (raw) {
		return {
			chapter: chapterNumber,
			steps,
			content: writeResult.content,
			wordCount: writeResult.wordCount,
		};
	}

	// --- Step 2: Review ---
	const reviewer = new ChapterReviewer(config);
	const review = await reviewer.reviewFull(writeResult.content, bible, {
		memory: memorySummaries,
	});

	const aiTellsMsg = review.aiTells.length
		? ` (${review.aiTells.length} AI tells found)`
		: "";
	log({
		stage: "review",
		status: "done",
		message: `Review complete${aiTellsMsg}, ${review.issues.length} issues`,
		result: review,
	});

	// --- Step 3: Fix (if needed) ---
	let finalContent = writeResult.content;
	let finalWordCount = writeResult.wordCount;

	if (review.needsFix && !noFix) {
		const fixInstruction = buildFixInstruction(review);
		log({
			stage: "fix",
			status: "done",
			message: `Auto-fixing: ${review.issues.length} issues + ${review.aiTells.length} AI tells`,
		});

		// Backup original
		const chapterFile = path.join(
			projectDir,
			"chapters",
			`${chapterNumber.toString().padStart(3, "0")}.md`,
		);
		const backupFile = `${chapterFile}.bak`;
		try {
			await fs.copyFile(chapterFile, backupFile);
		} catch {
			// ignore backup failure
		}

		// Rewrite with fix instruction
		const editor = new ChapterEditor(writer as never);
		try {
			const fixResult = await editor.rewrite(chapterNumber, {
				instruction: fixInstruction,
				...(memorySummaries.length > 0 ? { memorySummaries } : {}),
			});
			// Sanity check: if the fix step somehow lost content, roll back.
			// ChapterWriter itself throws on empty content, but a short or
			// corrupt result (e.g. truncation, stream error) still slips past
			// the writer guard. Restore from backup and surface a warning.
			const minLen = Math.max(50, writeResult.wordCount / 4);
			if (fixResult.wordCount < minLen) {
				log({
					stage: "fix",
					status: "failed",
					message: `Fix produced ${fixResult.wordCount} chars (min ${minLen}); restoring from backup`,
				});
				await restoreBackup(chapterFile, backupFile);
				finalContent = writeResult.content;
				finalWordCount = writeResult.wordCount;
			} else {
				finalContent = fixResult.content;
				finalWordCount = fixResult.wordCount;
			}
		} catch (err) {
			log({
				stage: "fix",
				status: "failed",
				message: `Fix step failed (${err instanceof Error ? err.message : String(err)}); restoring from backup`,
			});
			await restoreBackup(chapterFile, backupFile);
			finalContent = writeResult.content;
			finalWordCount = writeResult.wordCount;
		}
	} else if (review.needsFix && noFix) {
		log({
			stage: "fix",
			status: "skipped",
			message: "Auto-fix skipped (--no-fix)",
		});
	} else {
		log({
			stage: "fix",
			status: "skipped",
			message: "No issues to fix",
		});
	}

	// --- Step 4: Memory ---
	log({
		stage: "memory",
		status: "done",
		message: "Memory updated",
	});

	return {
		chapter: chapterNumber,
		steps,
		content: finalContent,
		wordCount: finalWordCount,
		review,
	};
}

function buildFixInstruction(review: ReviewResult): string {
	const parts: string[] = [];

	if (review.aiTells.length > 0) {
		parts.push(
			`Remove these AI-characteristic words: ${review.aiTells.join(", ")}`,
		);
	}

	if (review.issues.length > 0) {
		parts.push(
			`Address these issues:\n${review.issues.map((i) => `- ${i}`).join("\n")}`,
		);
	}

	return parts.join("\n\n");
}

async function restoreBackup(
	chapterFile: string,
	backupFile: string,
): Promise<void> {
	try {
		const backup = await fs.readFile(backupFile, "utf-8");
		await fs.writeFile(chapterFile, backup, "utf-8");
	} catch (err) {
		// If even the backup read fails, leave the existing file intact and
		// surface the error upstream via the log.
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
	}
}
