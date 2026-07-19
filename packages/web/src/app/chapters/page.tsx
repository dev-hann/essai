"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";

interface ChapterListItem {
	number: number;
	title: string;
	wordCount: number;
	status: string;
}

export default function ChaptersPage() {
	const [items, setItems] = useState<ChapterListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/chapters", { cache: "no-store" });
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
			setItems((await res.json()) as ChapterListItem[]);
		} catch (err) {
			setError(err instanceof Error ? err.message : "load failed");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const create = useCallback(async () => {
		try {
			const res = await fetch("/api/chapters", { method: "POST" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { number: number };
			await load();
			return data.number;
		} catch (err) {
			setError(err instanceof Error ? err.message : "create failed");
			return null;
		}
	}, [load]);

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 p-8">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="text-2xl font-semibold text-neutral-100">챕터</h1>
					<button
						type="button"
						onClick={() => void create()}
						className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
					>
						새 챕터
					</button>
				</div>

				{loading ? (
					<p className="text-sm text-neutral-400">불러오는 중…</p>
				) : error ? (
					<p className="text-sm text-red-400">{error}</p>
				) : items.length === 0 ? (
					<p className="text-sm text-neutral-400">
						아직 챕터가 없습니다. "새 챕터"를 눌러 시작하세요.
					</p>
				) : (
					<ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
						{items.map((item) => (
							<li key={item.number}>
								<Link
									href={`/chapters/${item.number}`}
									className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-neutral-900"
								>
									<span className="w-10 text-sm tabular-nums text-neutral-400">
										{item.number.toString().padStart(3, "0")}
									</span>
									<span className="flex-1 text-sm text-neutral-100">
										{item.title}
									</span>
									<span className="text-xs tabular-nums text-neutral-500">
										{item.wordCount.toLocaleString()}자
									</span>
									<span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
										{item.status}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</main>
		</div>
	);
}
