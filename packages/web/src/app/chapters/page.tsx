import Link from "next/link";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadBible } from "@essai/core";
import { Card } from "@/components/ui.js";
import { getProjectDir } from "@/lib/project-dir.js";
import { listChapterFiles } from "@/lib/chapters.js";

export const dynamic = "force-dynamic";

export default async function ChaptersListPage() {
	const cwd = getProjectDir();
	const bible = await loadBible(path.join(cwd, "bible"));
	const files = await listChapterFiles(cwd);

	const writtenMap = new Map<number, number>();
	for (const name of files) {
		const num = Number.parseInt(name.replace(/\D/g, ""), 10);
		if (!Number.isFinite(num)) continue;
		try {
			const raw = await fs.readFile(
				path.join(cwd, "chapters", name),
				"utf-8",
			);
			writtenMap.set(num, raw.length);
		} catch {
			// skip
		}
	}

	const planned = Array.from(bible.chapters.keys()).sort((a, b) => a - b);
	const writtenNumbers = Array.from(writtenMap.keys()).sort((a, b) => a - b);
	const allNumbers = Array.from(
		new Set<number>([...planned, ...writtenNumbers]),
	).sort((a, b) => a - b);

	return (
		<div className="max-w-4xl mx-auto p-8">
			<header className="mb-6">
				<h1 className="text-xl font-semibold">챕터</h1>
				<p className="text-[12px] text-[var(--color-text-mute)] mt-1">
					{writtenNumbers.length} / {planned.length || "?"} 화 작성 완료
				</p>
			</header>

			<Card>
				{allNumbers.length === 0 ? (
					<div className="text-[12px] text-[var(--color-text-mute)] py-4 text-center">
						챕터가 없습니다. Bible에서 챕터 계획을 추가하세요.
					</div>
				) : (
					<ul className="divide-y divide-[var(--color-border)]">
						{allNumbers.map((n) => {
							const plan = bible.chapters.get(n);
							const wordCount = writtenMap.get(n);
							const written = wordCount !== undefined;
							return (
								<li key={n}>
									<Link
										href={`/chapters/${n}`}
										className="flex items-center justify-between px-2 py-2.5 hover:bg-[var(--color-surface-2)] rounded transition-colors"
									>
										<div className="flex items-center gap-3 min-w-0">
											<span
												className={`text-[11px] w-4 inline-flex justify-center ${written ? "text-[var(--color-success)]" : "text-[var(--color-text-mute)]"}`}
											>
												{written ? "✓" : "−"}
											</span>
											<div className="min-w-0">
												<div className="text-[13px] truncate">
													{n}화
													{plan?.title
														? `: ${plan.title}`
														: ""}
												</div>
												{!written && plan && (
													<div className="text-[11px] text-[var(--color-text-mute)]">
														{plan.scenes.length}개 씬 · 대기 중
													</div>
												)}
											</div>
										</div>
										<div className="text-[11px] text-[var(--color-text-mute)]">
											{written
												? `${(wordCount ?? 0).toLocaleString()}자`
												: "대기"}
										</div>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</Card>
		</div>
	);
}
