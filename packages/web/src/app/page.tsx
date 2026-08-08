import { GlobalConfig } from "@essai/core";
import Link from "next/link";
import { Button, Card } from "@/components/ui.js";
import { loadProjectStats } from "@/lib/projectStats.js";

export const dynamic = "force-dynamic";

interface ProjectCard {
	id: string;
	name: string;
	path: string;
	writtenCount: number;
	plannedCount: number;
	totalCharacters: number;
	lastVisited: string | null;
}

async function loadProjects(): Promise<ProjectCard[]> {
	const global = await GlobalConfig.load();
	const entries = global.listProjects();

	const cards = await Promise.all(
		entries.map(async (entry) => {
			const stats = await loadProjectStats(entry.path).catch(() => ({
				writtenCount: 0,
				plannedCount: 0,
				totalCharacters: 0,
			}));
			return {
				id: entry.id,
				name: entry.name,
				path: entry.path,
				writtenCount: stats.writtenCount,
				plannedCount: stats.plannedCount,
				totalCharacters: stats.totalCharacters,
				lastVisited: entry.lastVisited ?? null,
			};
		}),
	);

	cards.sort((a, b) => {
		const at = a.lastVisited ? Date.parse(a.lastVisited) : 0;
		const bt = b.lastVisited ? Date.parse(b.lastVisited) : 0;
		if (at !== bt) return bt - at;
		return a.name.localeCompare(b.name);
	});

	return cards;
}

export default async function HomePage() {
	const projects = await loadProjects();

	return (
		<div className="max-w-4xl mx-auto p-8">
			<header className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold">프로젝트</h1>
					<p className="text-[12px] text-[var(--color-text-mute)] mt-1">
						{projects.length === 0
							? "등록된 프로젝트가 없습니다"
							: `${projects.length}개 프로젝트`}
					</p>
				</div>
				<Button
					variant="primary"
					type="button"
					title="터미널에서 `essai init <name>` 으로 새 프로젝트를 만드세요"
				>
					새 프로젝트
				</Button>
			</header>

			{projects.length === 0 ? (
				<Card>
					<div className="text-[13px] text-[var(--color-text-mute)] py-6 text-center">
						프로젝트가 없습니다.
						<div className="mt-2 text-[11px]">
							<code>essai init</code>으로 새 프로젝트를 만들어 시작하세요.
						</div>
					</div>
				</Card>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{projects.map((p) => {
						const progress =
							p.plannedCount === 0
								? 0
								: Math.round((p.writtenCount / p.plannedCount) * 100);
						return (
							<Link key={p.id} href={`/p/${p.id}`} className="block">
								<Card className="hover:border-[var(--color-border-hover)] transition-colors cursor-pointer">
									<div className="flex items-baseline justify-between mb-2">
										<div className="text-[14px] font-semibold truncate">
											{p.name}
										</div>
										<div className="text-[10px] text-[var(--color-text-mute)] font-mono truncate ml-2">
											{p.id}
										</div>
									</div>
									<div className="text-[12px] text-[var(--color-text-dim)] mb-2">
										{p.plannedCount === 0
											? `${p.writtenCount}화 작성됨`
											: `${p.plannedCount}화 중 ${p.writtenCount}화 완성`}
										{" · "}
										{p.totalCharacters.toLocaleString()}자
									</div>
									<div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
										<div
											className="h-full bg-[var(--color-accent)] transition-all"
											style={{ width: `${progress}%` }}
										/>
									</div>
								</Card>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
