import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { globalConfigMock, loadProjectStatsMock } = vi.hoisted(() => ({
	globalConfigMock: vi.fn(),
	loadProjectStatsMock: vi.fn(),
}));

vi.mock("@essai/core", () => ({
	GlobalConfig: {
		load: globalConfigMock,
		configPath: () => "/home/.essai/config.json",
	},
}));

vi.mock("@/lib/projectStats", () => ({
	loadProjectStats: loadProjectStatsMock,
}));

import HomePage from "@/app/page.js";

function resetMocks() {
	globalConfigMock.mockReset();
	loadProjectStatsMock.mockReset();

	globalConfigMock.mockResolvedValue({
		listProjects: () => [
			{
				id: "alpha",
				name: "Alpha",
				path: "/proj/alpha",
				lastVisited: "2025-01-01T00:00:00.000Z",
			},
			{
				id: "beta",
				name: "Beta",
				path: "/proj/beta",
				lastVisited: null,
			},
		],
	});

	loadProjectStatsMock.mockImplementation(async (projectDir: string) => {
		if (projectDir === "/proj/beta") {
			return {
				writtenCount: 0,
				plannedCount: 0,
				totalCharacters: 0,
			};
		}
		return {
			writtenCount: 3,
			plannedCount: 10,
			totalCharacters: 9000,
		};
	});
}

describe("HomePage (project list)", () => {
	beforeEach(() => {
		resetMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("lists projects from GlobalConfig", async () => {
		const tree = await HomePage();
		render(tree);

		expect(screen.getByText("Alpha")).toBeInTheDocument();
		expect(screen.getByText("Beta")).toBeInTheDocument();
		expect(screen.getByText("2개 프로젝트")).toBeInTheDocument();
	});

	it("links each card to /p/:id", async () => {
		const tree = await HomePage();
		render(tree);

		const alphaLink = screen.getByText("Alpha").closest("a");
		expect(alphaLink).toHaveAttribute("href", "/p/alpha");
	});

	it("shows chapter/word stats from loadProjectStats", async () => {
		const tree = await HomePage();
		render(tree);

		expect(
			screen.getByText(/10화 중 3화 완성 · 9,000자/),
		).toBeInTheDocument();
	});

	it("renders the empty state when there are no projects", async () => {
		globalConfigMock.mockResolvedValue({
			listProjects: () => [],
		});

		const tree = await HomePage();
		render(tree);

		expect(
			screen.getByText("등록된 프로젝트가 없습니다"),
		).toBeInTheDocument();
		expect(screen.getByText(/essai init/)).toBeInTheDocument();
	});

	it("shows the new-project button", async () => {
		const tree = await HomePage();
		render(tree);

		expect(screen.getByText("새 프로젝트")).toBeInTheDocument();
	});
});
