import { notFound } from "next/navigation";
import path from "node:path";
import { loadBible } from "@essai/core";
import { readChapterFile } from "@/lib/chapters.js";
import { ChapterDetailClient } from "@/components/ChapterDetailClient.js";
import { resolveProjectDir } from "@/lib/projectResolver.js";

export const dynamic = "force-dynamic";

interface PageProps {
	params: Promise<{ id: string; n: string }>;
	searchParams: Promise<{ action?: string }>;
}

export default async function ChapterDetailPage({
	params,
	searchParams,
}: PageProps) {
	const { id, n } = await params;
	const number = Number.parseInt(n, 10);
	if (!Number.isFinite(number) || number < 1) {
		notFound();
	}

	const { action } = await searchParams;
	const initialAction =
		action === "write" ? ("write" as const) : null;

	const cwd = await resolveProjectDir(id);
	const bible = await loadBible(path.join(cwd, "bible"));
	const content = await readChapterFile(cwd, number);
	const plan = bible.chapters.get(number);

	if (!content && !plan) {
		notFound();
	}

	return (
		<ChapterDetailClient
			projectId={id}
			number={number}
			initialContent={content ?? ""}
			wordCount={content?.length ?? 0}
			title={plan?.title ?? null}
			planned={plan !== undefined}
			initialAction={initialAction}
		/>
	);
}
