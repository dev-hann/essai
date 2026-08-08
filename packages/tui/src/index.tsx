#!/usr/bin/env node
import { render, Text, useApp, useInput } from "ink";
import { type ReactNode, useState } from "react";
import {
	BiblePicker,
	BibleSectionView,
	ChapterList,
	ChapterView,
	ProjectMenu,
	ProjectPicker,
	ScreenShell,
} from "./components.js";
import {
	type ChapterSummary,
	latestChapterNumber,
	listBibleSections,
	listChapters,
	listProjects,
	readChapter,
	runEssaiCommand,
} from "./project-store.js";

type Screen =
	| { kind: "projects" }
	| { kind: "project-menu"; project: ProjectRef }
	| { kind: "chapters"; project: ProjectRef }
	| { kind: "chapter-view"; project: ProjectRef; chapter: ChapterSummary }
	| { kind: "bible"; project: ProjectRef }
	| { kind: "bible-section"; project: ProjectRef; section: BibleRef }
	| { kind: "command-result"; project: ProjectRef; message: string };

interface ProjectRef {
	name: string;
	path: string;
	id: string;
}

interface BibleRef {
	name: string;
	content: string;
}

function CommandResult(props: {
	message: string;
	onBack: () => void;
}): ReactNode {
	const { exit } = useApp();
	useInput((input, key) => {
		if (input === "q" || key.return || key.escape) props.onBack();
		else if (input === "Q") exit();
	});
	return (
		<ScreenShell title="result" onBack={props.onBack}>
			<Text>{props.message}</Text>
			<Text dimColor>press enter / q / esc to return to menu</Text>
		</ScreenShell>
	);
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

	async function runCommand(
		project: ProjectRef,
		label: string,
		args: string[],
	) {
		// Hide our render loop briefly so the spawned CLI can stream to the
		// terminal without Ink's output interleaving. The `useApp().exit()`
		// pattern would fully unmount; we use raw mode pause instead.
		process.stdout.write("\x1b[?25l"); // hide cursor while CLI runs
		const code = await runEssaiCommand(args, project.path);
		process.stdout.write("\x1b[?25h"); // restore cursor
		const message =
			code === 0 ? `${label} finished.` : `${label} exited with code ${code}`;
		setScreen({ kind: "command-result", project, message });
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
						else if (action === "bible") openBible(screen.project);
						else if (action === "write-next") {
							runCommand(screen.project, "essai write next", ["write", "next"]);
						} else if (action === "audit-latest") {
							latestChapterNumber(screen.project.path).then((n) => {
								if (n === null) {
									setScreen({
										kind: "command-result",
										project: screen.project,
										message: "No chapters to audit yet.",
									});
									return;
								}
								runCommand(screen.project, `essai audit ${n}`, [
									"audit",
									String(n),
								]);
							});
						}
					}}
					onBack={() => setScreen({ kind: "projects" })}
				/>
			);
		case "command-result":
			return (
				<CommandResult
					message={screen.message}
					onBack={() =>
						setScreen({ kind: "project-menu", project: screen.project })
					}
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
