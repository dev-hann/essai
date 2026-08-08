#!/usr/bin/env node
import { render } from "ink";
import { type ReactNode, useState } from "react";
import {
	BiblePicker,
	BibleSectionView,
	ChapterList,
	ChapterView,
	ProjectMenu,
	ProjectPicker,
} from "./components.js";
import {
	type ChapterSummary,
	listBibleSections,
	listChapters,
	listProjects,
	readChapter,
} from "./project-store.js";

type Screen =
	| { kind: "projects" }
	| { kind: "project-menu"; project: ProjectRef }
	| { kind: "chapters"; project: ProjectRef }
	| { kind: "chapter-view"; project: ProjectRef; chapter: ChapterSummary }
	| { kind: "bible"; project: ProjectRef }
	| { kind: "bible-section"; project: ProjectRef; section: BibleRef };

interface ProjectRef {
	name: string;
	path: string;
	id: string;
}

interface BibleRef {
	name: string;
	content: string;
}

interface AppProps {
	projects: ProjectRef[];
}

function App({ projects }: AppProps): ReactNode {
	const [screen, setScreen] = useState<Screen>({ kind: "projects" });
	const [chapters, setChapters] = useState<ChapterSummary[]>([]);
	const [bibleSections, setBibleSections] = useState<BibleRef[]>([]);
	const [chapterContent, setChapterContent] = useState<string | null>(null);

	async function openChapters(project: ProjectRef) {
		const list = await listChapters(project.path);
		setChapters(list);
		setScreen({ kind: "chapters", project });
	}

	async function openChapter(project: ProjectRef, chapter: ChapterSummary) {
		const content = await readChapter(project.path, chapter.number);
		setChapterContent(content);
		setScreen({ kind: "chapter-view", project, chapter });
	}

	async function openBible(project: ProjectRef) {
		const list = await listBibleSections(project.path);
		setBibleSections(list);
		setScreen({ kind: "bible", project });
	}

	switch (screen.kind) {
		case "projects":
			return (
				<ProjectPicker
					projects={projects}
					onSelect={(p) => setScreen({ kind: "project-menu", project: p })}
				/>
			);
		case "project-menu":
			return (
				<ProjectMenu
					project={screen.project}
					onSelect={(action) => {
						if (action === "chapters") openChapters(screen.project);
						else openBible(screen.project);
					}}
					onBack={() => setScreen({ kind: "projects" })}
				/>
			);
		case "chapters":
			return (
				<ChapterList
					chapters={chapters}
					onSelect={(c) => openChapter(screen.project, c)}
					onBack={() =>
						setScreen({ kind: "project-menu", project: screen.project })
					}
				/>
			);
		case "chapter-view":
			return chapterContent === null ? null : (
				<ChapterView
					chapter={screen.chapter}
					content={chapterContent}
					onBack={() =>
						setScreen({ kind: "chapters", project: screen.project })
					}
				/>
			);
		case "bible":
			return (
				<BiblePicker
					sections={bibleSections}
					onSelect={(section) =>
						setScreen({
							kind: "bible-section",
							project: screen.project,
							section,
						})
					}
					onBack={() =>
						setScreen({ kind: "project-menu", project: screen.project })
					}
				/>
			);
		case "bible-section":
			return (
				<BibleSectionView
					section={screen.section}
					onBack={() => setScreen({ kind: "bible", project: screen.project })}
				/>
			);
	}
}

async function main(): Promise<void> {
	const projects = (await listProjects()).map((p) => ({
		name: p.name,
		path: p.path,
		id: p.id,
	}));
	render(<App projects={projects} />);
}

main().catch((err: unknown) => {
	process.stderr.write(
		`essai-tui failed: ${err instanceof Error ? err.message : String(err)}\n`,
	);
	process.exit(1);
});
