import type { ReactNode } from "react";
import Link from "next/link";

interface SidebarItemProps {
	href: string;
	label: string;
	icon: string;
	active: boolean;
}

function SidebarItem({ href, label, icon, active }: SidebarItemProps) {
	return (
		<Link
			href={href}
			className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-colors ${
				active
					? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
					: "text-[var(--color-text-dim)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
			}`}
		>
			<span className="w-4 text-center">{icon}</span>
			<span>{label}</span>
		</Link>
	);
}

export interface ChapterStatus {
	number: number;
	wordCount: number;
	written: boolean;
}

interface SidebarShellProps {
	nav: ReactNode;
	chapterList: ReactNode;
	writeNextHref: string | null;
}

export function SidebarShell({
	nav,
	chapterList,
	writeNextHref,
}: SidebarShellProps) {
	return (
		<aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col h-screen sticky top-0">
			<div className="px-4 py-4 flex items-center gap-2 border-b border-[var(--color-border)]">
				<span className="text-[var(--color-accent)] text-lg">◆</span>
				<span className="font-semibold tracking-tight">Essai</span>
			</div>

			<nav className="px-2 py-3 flex flex-col gap-0.5 border-b border-[var(--color-border)]">
				{nav}
			</nav>

			<div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
				챕터
			</div>

			<div className="flex-1 overflow-y-auto scrollbar px-2 pb-2">
				{chapterList}
			</div>

			{writeNextHref && (
				<div className="p-2 border-t border-[var(--color-border)]">
					<Link
						href={writeNextHref}
						className="block text-center px-3 py-2 rounded-md bg-[var(--color-accent)] text-[#0d0f14] text-[13px] font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
					>
						+ 다음 화
					</Link>
				</div>
			)}
		</aside>
	);
}

interface SidebarProps {
	pathname: string;
	chapters: ChapterStatus[];
	planned: number[];
}

export function SidebarContent({ pathname, chapters, planned }: SidebarProps) {
	const writtenSet = new Set(chapters.map((c) => c.number));
	const allNumbers = new Set<number>([...writtenSet, ...planned]);
	const sorted = Array.from(allNumbers).sort((a, b) => a - b);

	const navItems = [
		{ href: "/", label: "대시보드", icon: "📊" },
		{ href: "/chapters", label: "챕터", icon: "📖" },
		{ href: "/bible", label: "Bible", icon: "📓" },
		{ href: "/settings", label: "설정", icon: "⚙️" },
	];

	const isActive = (href: string): boolean => {
		if (href === "/") return pathname === "/";
		return pathname === href || pathname.startsWith(`${href}/`);
	};

	const nav = (
		<>
			{navItems.map((item) => (
				<SidebarItem
					key={item.href}
					href={item.href}
					label={item.label}
					icon={item.icon}
					active={isActive(item.href)}
				/>
			))}
		</>
	);

	const nextUnwritten = sorted.find((n) => !writtenSet.has(n)) ?? null;
	const writeNextHref =
		nextUnwritten !== null
			? `/chapters/${nextUnwritten}?action=write`
			: null;

	const chapterList =
		sorted.length === 0 ? (
			<div className="px-2 py-4 text-[12px] text-[var(--color-text-mute)]">
				계획된 챕터가 없습니다.
			</div>
		) : (
			<ul className="flex flex-col gap-0.5">
				{sorted.map((n) => {
					const written = writtenSet.has(n);
					const chapter = chapters.find((c) => c.number === n);
					const wordCount = chapter?.wordCount ?? 0;
					const active = pathname === `/chapters/${n}`;
					return (
						<li key={`ch-${n}`}>
							<Link
								href={`/chapters/${n}`}
								className={`flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition-colors ${
									active
										? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
										: "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
								}`}
							>
								<span
									className={`text-[10px] w-3 ${written ? "text-[var(--color-success)]" : "text-[var(--color-text-mute)]"}`}
								>
									{written ? "✓" : "−"}
								</span>
								<span className="flex-1 truncate">{n}화</span>
								{written ? (
									<span className="text-[10px] text-[var(--color-text-mute)]">
										{wordCount.toLocaleString()}자
									</span>
								) : (
									<span className="text-[10px] text-[var(--color-text-mute)]">
										대기
									</span>
								)}
							</Link>
						</li>
					);
				})}
			</ul>
		);

	return (
		<SidebarShell
			nav={nav}
			chapterList={chapterList}
			writeNextHref={writeNextHref}
		/>
	);
}
