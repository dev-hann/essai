"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
	SidebarContent,
	type ChapterStatus,
	type ProjectOption,
} from "@/components/Sidebar.js";

interface ChaptersApiResponse {
	chapters: Array<{ id: string; number: number; wordCount: number }>;
	planned: number[];
}

interface ProjectsApiResponse {
	projects: Array<{
		id: string;
		name: string;
	}>;
}

function extractProjectId(pathname: string): string | null {
	const m = pathname.match(/^\/p\/([^/]+)/);
	return m?.[1] ?? null;
}

export function Sidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const projectId = extractProjectId(pathname ?? "");

	const [projects, setProjects] = useState<ProjectOption[]>([]);
	const [chapters, setChapters] = useState<ChapterStatus[]>([]);
	const [planned, setPlanned] = useState<number[]>([]);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/projects", { cache: "no-store" })
			.then(async (res) => {
				if (!res.ok) return;
				const data = (await res.json()) as ProjectsApiResponse;
				if (cancelled) return;
				setProjects(
					data.projects.map((p) => ({ id: p.id, name: p.name })),
				);
			})
			.catch(() => {
				// sidebar is non-critical
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const refresh = useCallback(async () => {
		if (!projectId) {
			setChapters([]);
			setPlanned([]);
			return;
		}
		try {
			const res = await fetch(`/api/projects/${projectId}/chapters`, {
				cache: "no-store",
			});
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
	}, [projectId]);

	useEffect(() => {
		void refresh();
	}, [refresh, pathname]);

	useEffect(() => {
		const onFocus = () => void refresh();
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [refresh]);

	useEffect(() => {
		const handler = () => {
			void refresh();
			router.refresh();
		};
		window.addEventListener("essai:refresh-sidebar", handler);
		return () =>
			window.removeEventListener("essai:refresh-sidebar", handler);
	}, [refresh, router]);

	if (!projectId) {
		// No project context (e.g. on the home page) — render nothing so the
		// main content takes the full width.
		return null;
	}

	return (
		<SidebarContent
			pathname={pathname ?? "/"}
			projectId={projectId}
			projects={projects}
			chapters={chapters}
			planned={planned}
			onProjectChange={(id) => router.push(`/p/${id}`)}
		/>
	);
}
