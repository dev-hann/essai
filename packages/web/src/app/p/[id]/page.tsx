import Link from "next/link";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
	findEmotionStage,
	loadBible,
	MemoryStore,
	type ChapterMemory,
} from "@essai/core";
import { Card, CardHeader, Button } from "@/components/ui.js";
import { ExportButton } from "@/components/ExportButton.js";
import { listChapterFiles } from "@/lib/chapters.js";
import { resolveProjectDir } from "@/lib/projectResolver.js";

export const dynamic = "force-dynamic";

const MEMORY_DIR = "memory";
const MEMORY_RECENT_COUNT = 3;
const OPEN_FORESHADOW_STATUSES = new Set(["unresolved", "active"]);

async function loadDashboard(projectDir: string) {
	const cwd = projectDir;
	const bible = await loadBible(path.join(cwd, "bible"));
	const files = await listChapterFiles(cwd);

	const writtenNumbers = files
		.map((name) => Number.parseInt(name.replace(/\D/g, ""), 10))
		.filter((n) => Number.isFinite(n))
		.sort((a, b) => a - b);
	const count = writtenNumbers.length;
	const latest = count === 0 ? 0 : (writtenNumbers[count - 1] ?? 0);
	const planned = Array.from(bible.chapters.keys()).sort((a, b) => a - b);

	const next =
		count === 0 ? (planned[0] ?? null) : nextAfter(latest, planned);

	let totalCharacters = 0;
	for (const name of files) {
		const raw = await fs.readFile(
			path.join(cwd, "chapters", name),
			"utf-8",
		);
		totalCharacters += raw.length;
	}

	const recentMemories = await new MemoryStore().loadRecent(
		path.join(cwd, MEMORY_DIR),
		MEMORY_RECENT_COUNT,
	);

	const emotionStage =
		bible.emotion.length > 0 && next !== null
			? findEmotionStage(bible.emotion, next)
			: null;

	const openForeshadowing = collectOpenForeshadowing(recentMemories);

	return {
		writtenCount: count,
		plannedCount: planned.length,
		next,
		totalCharacters,
		emotionStage,
		openForeshadowing,
	};
}

function nextAfter(latestWritten: number, planned: number[]): number | null {
	if (planned.length === 0) return null;
	const sorted = [...planned].sort((a, b) => a - b);
	const max = sorted[sorted.length - 1];
	if (max === undefined) return null;
	for (let n = latestWritten + 1; n <= max; n++) {
		if (planned.includes(n)) return n;
	}
	return null;
}

function collectOpenForeshadowing(memories: ChapterMemory[]) {
	const seen = new Set<string>();
	const out: Array<{ chapter: number; item: string }> = [];
	for (const memory of memories) {
		for (const item of memory.foreshadowing) {
			if (!OPEN_FORESHADOW_STATUSES.has(item.status)) continue;
			const key = `${item.chapterIntroduced}:${item.item}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({
				chapter: item.chapterIntroduced,
				item: item.item,
			});
		}
	}
	return out;
}

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function DashboardPage({ params }: PageProps) {
	const { id } = await params;
	const projectDir = await resolveProjectDir(id);
	const data = await loadDashboard(projectDir);
	const progress =
		data.plannedCount === 0
			? 0
			: Math.round((data.writtenCount / data.plannedCount) * 100);

	return (
		<div className="max-w-4xl mx-auto p-8">
			<header className="mb-6">
				<h1 className="text-xl font-semibold">대시보드</h1>
				<p className="text-[12px] text-[var(--color-text-mute)] mt-1">
					프로젝트 진행 상황
				</p>
			</header>

			<div className="grid gap-4">
				<Card>
					<CardHeader title="진행 상황" />
					<div className="flex items-baseline justify-between mb-2">
						<div className="text-[13px]">
							<span className="text-[var(--color-text)]">
								{data.plannedCount}화 중 {data.writtenCount}화 완성
							</span>
						</div>
						<div className="text-[12px] text-[var(--color-text-dim)]">
							총 {data.totalCharacters.toLocaleString()}자
						</div>
					</div>
					<div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
						<div
							className="h-full bg-[var(--color-accent)] transition-all"
							style={{ width: `${progress}%` }}
						/>
					</div>
					<div className="mt-2 text-[11px] text-[var(--color-text-mute)]">
						{progress}%
					</div>
				</Card>

				<Card>
					<CardHeader
						title="감정 곡선"
						subtitle={
							data.next === null
								? "다음 챕터가 없습니다"
								: `${data.next}화 기준`
						}
					/>
					{data.emotionStage ? (
						<div className="flex items-center gap-3">
							<div className="text-[var(--color-accent)] text-[20px] font-semibold">
								{data.emotionStage.stage}단계
							</div>
							<div>
								<div className="text-[14px]">
									{data.emotionStage.name}
								</div>
								<div className="text-[11px] text-[var(--color-text-mute)]">
									{data.emotionStage.chapters}
								</div>
							</div>
						</div>
					) : (
						<div className="text-[12px] text-[var(--color-text-mute)]">
							감정 단계 정보가 없습니다.
						</div>
					)}
				</Card>

				<Card>
					<CardHeader
						title={`미회수 복선 (${data.openForeshadowing.length})`}
					/>
					{data.openForeshadowing.length === 0 ? (
						<div className="text-[12px] text-[var(--color-text-mute)]">
							미회수 복선이 없습니다.
						</div>
					) : (
						<ul className="space-y-1.5 text-[12px]">
							{data.openForeshadowing.slice(0, 12).map((f, i) => (
								<li
									key={`${f.chapter}-${i}`}
									className="flex gap-2"
								>
									<span className="text-[var(--color-text-mute)]">
										{f.chapter}화
									</span>
									<span className="text-[var(--color-text-dim)]">
										{f.item}
									</span>
								</li>
							))}
						</ul>
					)}
				</Card>

				<div className="flex gap-2 items-start">
					<ExportButton projectId={id} />
					{data.next !== null && (
						<Link
							href={`/p/${id}/chapters/${data.next}?action=write`}
						>
							<Button variant="primary">다음 화 쓰기</Button>
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}
