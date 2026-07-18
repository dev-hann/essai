import type {
	WriteChapterOptions,
	WriteChapterResult,
} from "../writer/chapter-writer.js";

export interface ChapterEditorOptions {
	instruction?: string;
	onToken?: (delta: string) => void;
	memorySummaries?: WriteChapterOptions["memorySummaries"];
}

export interface PartialRewriteOptions {
	instruction?: string;
	onToken?: (delta: string) => void;
	memorySummaries?: WriteChapterOptions["memorySummaries"];
}

interface WriterLike {
	writeChapter(
		chapter: number,
		options: WriteChapterOptions,
	): Promise<WriteChapterResult>;
}

function buildPartialDirective(section: string): string {
	return `Rewrite only the "${section}" portion of this chapter, preserving every other beat, line, and detail from the existing chapter.`;
}

function combineInstruction(
	directive: string,
	instruction: string | undefined,
): string {
	return instruction ? `${directive} ${instruction}` : directive;
}

export class ChapterEditor {
	constructor(private readonly writer: WriterLike) {}

	async rewrite(
		chapter: number,
		options: ChapterEditorOptions = {},
	): Promise<WriteChapterResult> {
		const callOptions: WriteChapterOptions = {};
		if (options.instruction !== undefined) {
			callOptions.instruction = options.instruction;
		}
		if (options.memorySummaries !== undefined) {
			callOptions.memorySummaries = options.memorySummaries;
		}
		if (options.onToken !== undefined) {
			callOptions.onToken = options.onToken;
		}
		return this.writer.writeChapter(chapter, callOptions);
	}

	async partialRewrite(
		chapter: number,
		section: string,
		options: PartialRewriteOptions = {},
	): Promise<WriteChapterResult> {
		const directive = buildPartialDirective(section);
		const instruction = combineInstruction(directive, options.instruction);
		const callOptions: WriteChapterOptions = { instruction };
		if (options.memorySummaries !== undefined) {
			callOptions.memorySummaries = options.memorySummaries;
		}
		if (options.onToken !== undefined) {
			callOptions.onToken = options.onToken;
		}
		return this.writer.writeChapter(chapter, callOptions);
	}
}
