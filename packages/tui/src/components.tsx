import { Box, Text, useApp, useInput } from "ink";
import { type ReactNode, useState } from "react";
import type { ChapterSummary } from "./project-store.js";

/**
 * Shared TUI primitives. The screens below compose these to render the
 * dashboard / chapter / bible views. All screens handle `q`/Esc as a
 * back/exit gesture so the user is never trapped.
 *
 * We intentionally avoid third-party Ink widgets to keep the React 19
 * upgrade path clean (ink-select-input still pins React 18). The built-in
 * Select component below covers the same UX with raw Ink hooks.
 */

export interface SelectItem<T> {
	key: string;
	label: string;
	value: T;
}

interface SelectInputProps<T> {
	items: SelectItem<T>[];
	onSelect: (value: T) => void;
}

function SelectInput<T>({ items, onSelect }: SelectInputProps<T>): ReactNode {
	const [active, setActive] = useState(0);
	useInput((input, key) => {
		if (items.length === 0) return;
		if (key.upArrow) {
			setActive((i) => (i - 1 + items.length) % items.length);
		} else if (key.downArrow) {
			setActive((i) => (i + 1) % items.length);
		} else if (key.return) {
			const item = items[active];
			if (item) onSelect(item.value);
		}
	});
	return (
		<Box flexDirection="column">
			{items.map((item, i) => (
				<Box key={item.key}>
					{i === active ? (
						<Text color="cyan">{`❯ ${item.label}`}</Text>
					) : (
						<Text>{`  ${item.label}`}</Text>
					)}
				</Box>
			))}
		</Box>
	);
}

export interface ListItem {
	key: string;
	label: string;
	value: unknown;
}

interface ScreenShellProps {
	title: string;
	hint?: string | undefined;
	children: ReactNode;
	onBack?: () => void;
}

export function ScreenShell({
	title,
	hint,
	children,
	onBack,
}: ScreenShellProps): ReactNode {
	const { exit } = useApp();
	useInput((input, key) => {
		if (input === "q") {
			if (onBack) onBack();
			else exit();
		} else if (key.escape) {
			if (onBack) onBack();
			else exit();
		}
	});
	return (
		<Box flexDirection="column" paddingX={1} paddingY={0}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					essai › {title}
				</Text>
			</Box>
			<Box flexDirection="column">{children}</Box>
			{hint !== undefined && (
				<Box marginTop={1}>
					<Text dimColor>{hint}</Text>
				</Box>
			)}
			<Box marginTop={1}>
				<Text dimColor>↑↓ select · enter open · q/esc back · ctrl-c quit</Text>
			</Box>
		</Box>
	);
}

interface ProjectPickerProps {
	projects: Array<{ name: string; path: string; id: string }>;
	onSelect: (project: { name: string; path: string; id: string }) => void;
}

export function ProjectPicker({
	projects,
	onSelect,
}: ProjectPickerProps): ReactNode {
	const items: SelectInputProps<
		ProjectPickerProps["projects"][number]
	>["items"] = projects.map((p) => ({
		key: p.id,
		label: `${p.name}  (${p.path})`,
		value: p,
	}));
	return (
		<ScreenShell
			title="projects"
			hint={
				projects.length === 0 ? "Run `essai init <name>` first." : undefined
			}
		>
			{projects.length === 0 ? (
				<Text dimColor>No projects registered.</Text>
			) : (
				<SelectInput items={items} onSelect={(p) => onSelect(p)} />
			)}
		</ScreenShell>
	);
}

interface ChapterListProps {
	chapters: ChapterSummary[];
	onSelect: (chapter: ChapterSummary) => void;
	onBack: () => void;
}

export function ChapterList({
	chapters,
	onSelect,
	onBack,
}: ChapterListProps): ReactNode {
	const items: SelectInputProps<ChapterSummary>["items"] = chapters.map(
		(c) => ({
			key: c.fileName,
			label: `${c.number.toString().padStart(3, "0")}.md  (${c.wordCount} chars)`,
			value: c,
		}),
	);
	return (
		<ScreenShell
			title="chapters"
			hint={
				chapters.length === 0
					? "Run `essai write 1` first."
					: `${chapters.length} chapter(s) on disk.`
			}
			onBack={onBack}
		>
			{chapters.length === 0 ? (
				<Text dimColor>No chapters yet.</Text>
			) : (
				<SelectInput items={items} onSelect={(c) => onSelect(c)} />
			)}
		</ScreenShell>
	);
}

interface ChapterViewProps {
	chapter: ChapterSummary;
	content: string;
	onBack: () => void;
}

export function ChapterView({
	chapter,
	content,
	onBack,
}: ChapterViewProps): ReactNode {
	// Truncate very long chapters so the terminal stays usable. The full
	// content lives on disk and can be opened in $EDITOR via `essai read`.
	const preview =
		content.length > 4000
			? `${content.slice(0, 4000)}\n\n… (truncated; ${content.length - 4000} more chars)`
			: content;
	return (
		<ScreenShell
			title={`chapter ${chapter.number.toString().padStart(3, "0")}`}
			hint={`${content.length} chars on disk`}
			onBack={onBack}
		>
			<Text>{preview}</Text>
		</ScreenShell>
	);
}

interface BiblePickerProps {
	sections: Array<{ name: string; content: string }>;
	onSelect: (section: { name: string; content: string }) => void;
	onBack: () => void;
}

export function BiblePicker({
	sections,
	onSelect,
	onBack,
}: BiblePickerProps): ReactNode {
	const items: SelectInputProps<BiblePickerProps["sections"][number]>["items"] =
		sections.map((s) => ({
			key: s.name,
			label: s.name,
			value: s,
		}));
	return (
		<ScreenShell
			title="bible"
			hint={
				sections.length === 0
					? "Run `essai bible init <template>` first."
					: `${sections.length} section(s).`
			}
			onBack={onBack}
		>
			{sections.length === 0 ? (
				<Text dimColor>bible/ empty.</Text>
			) : (
				<SelectInput items={items} onSelect={(s) => onSelect(s)} />
			)}
		</ScreenShell>
	);
}

interface BibleSectionViewProps {
	section: { name: string; content: string };
	onBack: () => void;
}

export function BibleSectionView({
	section,
	onBack,
}: BibleSectionViewProps): ReactNode {
	const preview =
		section.content.length > 4000
			? `${section.content.slice(0, 4000)}\n\n… (truncated)`
			: section.content;
	return (
		<ScreenShell title={section.name} onBack={onBack}>
			<Text>{preview}</Text>
		</ScreenShell>
	);
}

/** Tiny top-level menu for a single project. */
interface ProjectMenuProps {
	project: { name: string; path: string };
	onSelect: (
		action:
			| "chapters"
			| "bible"
			| "write-next"
			| "audit-latest"
			| "bible-agent",
	) => void;
	onBack: () => void;
}

export function ProjectMenu({
	project,
	onSelect,
	onBack,
}: ProjectMenuProps): ReactNode {
	const items: SelectInputProps<
		"chapters" | "bible" | "write-next" | "audit-latest" | "bible-agent"
	>["items"] = [
		{ key: "chapters", label: "📖 Chapters", value: "chapters" },
		{ key: "bible", label: "📓 Bible", value: "bible" },
		{ key: "write-next", label: "✍️  Write next chapter", value: "write-next" },
		{
			key: "audit-latest",
			label: "🔍 Audit latest chapter",
			value: "audit-latest",
		},
		{
			key: "bible-agent",
			label: "🤖 Bible agent chat",
			value: "bible-agent",
		},
	];
	return (
		<ScreenShell
			title={`${project.name} — menu`}
			hint={`path: ${project.path}`}
			onBack={onBack}
		>
			<SelectInput items={items} onSelect={(action) => onSelect(action)} />
		</ScreenShell>
	);
}

/** Hook helper: track which "screen" we are on so we can render a stack. */
export function useScreenStack<T>(initial: T): {
	current: T;
	push: (next: T) => void;
	pop: () => void;
	reset: (next: T) => void;
} {
	const [stack, setStack] = useState<T[]>([initial]);
	return {
		get current(): T {
			return stack[stack.length - 1] as T;
		},
		push(next: T) {
			setStack((prev) => [...prev, next]);
		},
		pop() {
			setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
		},
		reset(next: T) {
			setStack([next]);
		},
	};
}
