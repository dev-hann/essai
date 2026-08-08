import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
	resolveProjectDirMock,
	loadBibleMock,
	loadRecentMock,
	MemoryStoreMock,
} = vi.hoisted(() => ({
	resolveProjectDirMock: vi.fn(),
	loadBibleMock: vi.fn(),
	loadRecentMock: vi.fn(),
	MemoryStoreMock: vi.fn(),
}));

vi.mock("@/lib/projectResolver", () => ({
	resolveProjectDir: resolveProjectDirMock,
	ProjectNotFoundError: class extends Error {},
}));

vi.mock("@/lib/chapters", () => ({
	listChapterFiles: vi.fn().mockResolvedValue(["001.md"]),
}));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	actual.promises.readFile = vi.fn().mockResolvedValue("본문 내용");
	actual.promises.readdir = vi.fn().mockResolvedValue([]);
	return actual;
});

vi.mock("@essai/core", () => ({
	loadBible: loadBibleMock,
	findEmotionStage: vi.fn().mockReturnValue(null),
	MemoryStore: MemoryStoreMock,
}));

import DashboardPage from "@/app/p/[id]/page.js";

function resetCoreMocks() {
	resolveProjectDirMock.mockReset();
	loadBibleMock.mockReset();
	loadRecentMock.mockReset();
	MemoryStoreMock.mockReset();

	resolveProjectDirMock.mockResolvedValue("/fake/project");
	loadBibleMock.mockResolvedValue({
		chapters: new Map([
			[1, { title: "시작", scenes: [] }],
			[2, { title: "두번째", scenes: [] }],
		]),
		emotion: [],
	});

	loadRecentMock.mockResolvedValue([]);
	MemoryStoreMock.mockImplementation(() => ({ loadRecent: loadRecentMock }));
}

describe("DashboardPage (project-scoped)", () => {
	beforeEach(() => {
		resetCoreMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders the dashboard header and progress card", async () => {
		const tree = await DashboardPage({
			params: Promise.resolve({ id: "alpha" }),
		});
		render(tree);

		expect(screen.getByText("대시보드")).toBeInTheDocument();
		expect(screen.getByText("진행 상황")).toBeInTheDocument();
		expect(screen.getByText("감정 곡선")).toBeInTheDocument();
		expect(screen.getByText("미회수 복선 (0)")).toBeInTheDocument();
	});

	it("shows written vs planned chapter counts from the loaded data", async () => {
		const tree = await DashboardPage({
			params: Promise.resolve({ id: "alpha" }),
		});
		render(tree);

		expect(screen.getByText("2화 중 1화 완성")).toBeInTheDocument();
	});

	it("links the next-chapter button to the project-scoped path", async () => {
		const tree = await DashboardPage({
			params: Promise.resolve({ id: "alpha" }),
		});
		render(tree);

		const nextLink = screen.getByText("다음 화 쓰기").closest("a");
		expect(nextLink).toHaveAttribute(
			"href",
			"/p/alpha/chapters/2?action=write",
		);
	});

	it("renders the emotion stage card with a fallback when none available", async () => {
		const tree = await DashboardPage({
			params: Promise.resolve({ id: "alpha" }),
		});
		render(tree);

		const header = screen.getByText("감정 곡선");
		const card = header.parentElement?.parentElement;
		expect(card).not.toBeNull();
		expect(
			within(card!).getByText("감정 단계 정보가 없습니다."),
		).toBeInTheDocument();
	});

	it("resolves the project directory via resolveProjectDir", async () => {
		await DashboardPage({ params: Promise.resolve({ id: "alpha" }) });
		expect(resolveProjectDirMock).toHaveBeenCalledWith("alpha");
	});
});
