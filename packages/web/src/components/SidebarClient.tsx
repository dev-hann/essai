"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
	SidebarContent,
	type ChapterStatus,
} from "@/components/Sidebar.js";

interface ChaptersApiResponse {
	chapters: Array<{ id: string; number: number; wordCount: number }>;
	planned: number[];
}

export function Sidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const [chapters, setChapters] = useState<ChapterStatus[]>([]);
	const [planned, setPlanned] = useState<number[]>([]);

	const refresh = useCallback(async () => {
		try {
			const res = await fetch("/api/chapters", { cache: "no-store" });
			if (!res.ok) return;
			const data = (await res.json()) as ChaptersApiResponse;
			setChapters(
				data.chapters.map((c) => ({
					number: c.number,
					wordCount: c.wordCount,
					written: true,
				})),
			);
			setPlanned(data.planned);
		} catch {
			// sidebar is non-critical
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh, pathname]);

	useEffect(() => {
		const onFocus = () => refresh();
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [refresh]);

	useEffect(() => {
		const handler = () => {
			refresh();
			router.refresh();
		};
		window.addEventListener("essai:refresh-sidebar", handler);
		return () =>
			window.removeEventListener("essai:refresh-sidebar", handler);
	}, [refresh, router]);

	return (
		<SidebarContent
			pathname={pathname}
			chapters={chapters}
			planned={planned}
		/>
	);
}
