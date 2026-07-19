"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";

interface SectionState {
	content: string;
	dirty: boolean;
	saving: boolean;
}

type Sections = Record<string, SectionState>;

const DEFAULT_SECTIONS = [
	"characters",
	"relationships",
	"emotion",
	"chapters",
	"style",
	"tone",
	"constraints",
] as const;

const SECTION_LABELS: Record<string, string> = {
	characters: "캐릭터",
	relationships: "관계",
	emotion: "감정 곡선",
	chapters: "챕터 계획",
	style: "문체",
	tone: "톤",
	constraints: "제약",
};

function sectionFileName(section: string): string {
	return section.endsWith(".md") ? section : `${section}.md`;
}

export default function BiblePage() {
	const [sections, setSections] = useState<Sections>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [active, setActive] = useState<string>("characters");

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/bible", { cache: "no-store" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as Record<string, string>;
			const merged: Sections = {};
			for (const section of DEFAULT_SECTIONS) {
				const file = sectionFileName(section);
				merged[section] = {
					content: data[file] ?? "",
					dirty: false,
					saving: false,
				};
			}
			for (const [fileName, content] of Object.entries(data)) {
				const stem = fileName.replace(/\.md$/, "");
				if (!(stem in merged)) {
					merged[stem] = { content, dirty: false, saving: false };
				}
			}
			setSections(merged);
		} catch (err) {
			setError(err instanceof Error ? err.message : "load failed");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const saveSection = useCallback(async (section: string) => {
		const current = sections[section];
		if (!current) return;
		setSections((prev) => ({
			...prev,
			[section]: { content: current.content, dirty: current.dirty, saving: true },
		}));
		try {
			const res = await fetch(`/api/bible/${section}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: current.content }),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
			setSections((prev) => {
				const existing = prev[section];
				if (!existing) return prev;
				return {
					...prev,
					[section]: {
						content: existing.content,
						dirty: false,
						saving: false,
					},
				};
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "save failed");
			setSections((prev) => {
				const existing = prev[section];
				if (!existing) return prev;
				return {
					...prev,
					[section]: {
						content: existing.content,
						dirty: existing.dirty,
						saving: false,
					},
				};
			});
		}
	}, [sections]);

	const sectionKeys = useMemo(() => Object.keys(sections), [sections]);
	const activeState = sections[active];

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 p-8">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="text-2xl font-semibold text-neutral-100">
						바이블
					</h1>
				</div>

				{loading ? (
					<p className="text-sm text-neutral-400">불러오는 중…</p>
				) : (
					<div className="grid grid-cols-[200px_1fr] gap-6">
						<aside className="flex flex-col gap-1">
							{sectionKeys.map((key) => {
								const label = SECTION_LABELS[key] ?? key;
								const state = sections[key];
								return (
									<button
										key={key}
										type="button"
										onClick={() => setActive(key)}
										className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
											active === key
												? "bg-neutral-800 text-neutral-100"
												: "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
										}`}
									>
										<span>{label}</span>
										{state?.dirty ? (
											<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
										) : null}
									</button>
								);
							})}
						</aside>

						<section className="flex flex-col gap-3">
							{error ? (
								<p className="text-sm text-red-400">{error}</p>
							) : null}
							{activeState ? (
								<>
									<textarea
										value={activeState.content}
										onChange={(e) =>
											setSections((prev) => {
												const existing = prev[active];
												if (!existing) return prev;
												return {
													...prev,
													[active]: {
														content: e.target.value,
														dirty: true,
														saving: existing.saving,
													},
												};
											})
										}
										rows={22}
										className="w-full resize-y rounded-md border border-neutral-800 bg-neutral-900 p-4 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
										placeholder={`# ${SECTION_LABELS[active] ?? active}\n\n이 섹션의 내용을 작성하세요.`}
									/>
									<div className="flex items-center gap-3">
										<button
											type="button"
											onClick={() => void saveSection(active)}
											disabled={!activeState.dirty || activeState.saving}
											className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:opacity-50"
										>
											{activeState.saving ? "저장 중…" : "저장"}
										</button>
										{activeState.dirty ? (
											<span className="text-xs text-amber-400">
												저장되지 않은 변경
											</span>
										) : (
											<span className="text-xs text-neutral-500">
												저장됨
											</span>
										)}
									</div>
								</>
							) : null}
						</section>
					</div>
				)}
			</main>
		</div>
	);
}
