import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

// --- Mocks (hoisted) -------------------------------------------------------

// Note: page.tsx imports these with `.js` suffixes (`@/lib/project-dir.js`).
// Vite's resolver falls back from .js → .ts so vi.mock can target the
// extension-less module specifier.

const { fakeProjectDir, loadBibleMock, loadRecentMock, MemoryStoreMock } =
	vi.hoisted(() => ({
		fakeProjectDir: "/fake/project",
		loadBibleMock: vi.fn(),
		loadRecentMock: vi.fn(),
		MemoryStoreMock: vi.fn(),
	}));

vi.mock("@/lib/project-dir", () => ({
	getProjectDir: () => fakeProjectDir,
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

// Import the component AFTER mocks are in place.
import DashboardPage from "@/app/page.js";

function resetCoreMocks() {
	loadBibleMock.mockReset();
	loadRecentMock.mockReset();
	MemoryStoreMock.mockReset();

	loadBibleMock.mockResolvedValue({
		chapters: new Map([
			[1, { title: "시작", scenes: [] }],
			[2, { title: "두번째", scenes: [] }],
		]),
		emotion: [],
	});

	loadRecentMock.mockResolvedValue([]);
	MemoryStoreMock.mockImplementation(function () {
		return { loadRecent: loadRecentMock };
	});
}

describe("DashboardPage", () => {
	beforeEach(() => {
		resetCoreMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders the dashboard header and progress card", async () => {
		const tree = await DashboardPage();
		render(tree);

		expect(screen.getByText("대시보드")).toBeInTheDocument();
		expect(screen.getByText("진행 상황")).toBeInTheDocument();
		expect(screen.getByText("감정 곡선")).toBeInTheDocument();
		expect(
			screen.getByText("미회수 복선 (0)"),
		).toBeInTheDocument();
	});

	it("shows written vs planned chapter counts from the loaded data", async () => {
		const tree = await DashboardPage();
		render(tree);

		// loadBible returned 2 planned chapters, listChapterFiles returned 1 written
		expect(
			screen.getByText("2화 중 1화 완성"),
		).toBeInTheDocument();
	});

	it("shows the export button and a link to the next chapter", async () => {
		const tree = await DashboardPage();
		render(tree);

		const exportBtn = screen.getByText("전체 내보내기");
		expect(exportBtn).toBeInTheDocument();

		// chapters 001 is written; next unwritten planned is 2
		const nextLink = screen.getByText("다음 화 쓰기").closest("a");
		expect(nextLink).toHaveAttribute(
			"href",
			"/chapters/2?action=write",
		);
	});

	it("renders the emotion stage card with a fallback when none available", async () => {
		const tree = await DashboardPage();
		render(tree);

		// "감정 곡선" lives in CardHeader; the Card wrapper is two levels up
		// (h3 → CardHeader div → Card div).
		const header = screen.getByText("감정 곡선");
		const card = header.parentElement?.parentElement;
		expect(card).not.toBeNull();
		expect(
			within(card!).getByText("감정 단계 정보가 없습니다."),
		).toBeInTheDocument();
	});
});
