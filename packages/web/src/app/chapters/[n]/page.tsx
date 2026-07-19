import { notFound } from "next/navigation";
import path from "node:path";
import { loadBible } from "@essai/core";
import { getProjectDir } from "@/lib/project-dir.js";
import { readChapterFile } from "@/lib/chapters.js";
import { ChapterDetailClient } from "@/components/ChapterDetailClient.js";

export const dynamic = "force-dynamic";

interface PageProps {
	params: Promise<{ n: string }>;
	searchParams: Promise<{ action?: string }>;
}

export default async function ChapterDetailPage({
	params,
	searchParams,
}: PageProps) {
	const { n } = await params;
	const number = Number.parseInt(n, 10);
	if (!Number.isFinite(number) || number < 1) {
		notFound();
	}

	const { action } = await searchParams;
	const initialAction =
		action === "write" ? ("write" as const) : null;

	const cwd = getProjectDir();
	const bible = await loadBible(path.join(cwd, "bible"));
	const content = await readChapterFile(cwd, number);
	const plan = bible.chapters.get(number);

	if (!content && !plan) {
		notFound();
	}

	return (
		<ChapterDetailClient
			number={number}
			initialContent={content ?? ""}
			wordCount={content?.length ?? 0}
			title={plan?.title ?? null}
			planned={plan !== undefined}
			initialAction={initialAction}
		/>
	);
}
