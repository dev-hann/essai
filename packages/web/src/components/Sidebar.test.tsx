import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SidebarContent } from "@/components/Sidebar.js";

describe("SidebarContent", () => {
	it("renders the four primary nav links", () => {
		render(
			<SidebarContent pathname="/" chapters={[]} planned={[]} />,
		);

		const nav = screen.getByRole("navigation");
		const links = within(nav).getAllByRole("link");
		const labels = links.map((l) => l.textContent ?? "");

		expect(labels).toContain("📊대시보드");
		expect(labels).toContain("📖챕터");
		expect(labels).toContain("📓Bible");
		expect(labels).toContain("⚙️설정");
	});

	it("marks the matching nav item active based on pathname", () => {
		render(
			<SidebarContent pathname="/bible" chapters={[]} planned={[]} />,
		);

		const bibleLink = screen.getByText("Bible").closest("a");
		expect(bibleLink).not.toBeNull();
		expect(bibleLink?.className).toMatch(/bg-\[var\(--color-surface-2\)\]/);
	});

	it("lists both planned and written chapters sorted by number", () => {
		render(
			<SidebarContent
				pathname="/"
				chapters={[
					{ number: 3, wordCount: 1200, written: true },
					{ number: 1, wordCount: 900, written: true },
				]}
				planned={[1, 2, 3, 4]}
			/>,
		);

		// 1, 2, 3, 4 should all appear as chapter entries with "화" suffix
		expect(screen.getByText(/1화/)).toBeInTheDocument();
		expect(screen.getByText(/2화/)).toBeInTheDocument();
		expect(screen.getByText(/3화/)).toBeInTheDocument();
		expect(screen.getByText(/4화/)).toBeInTheDocument();
	});

	it("renders the empty state when no chapters are planned or written", () => {
		render(<SidebarContent pathname="/" chapters={[]} planned={[]} />);

		expect(
			screen.getByText("계획된 챕터가 없습니다."),
		).toBeInTheDocument();
	});

	it("renders the write-next button pointing at the first unwritten chapter", () => {
		render(
			<SidebarContent
				pathname="/"
				chapters={[{ number: 1, wordCount: 800, written: true }]}
				planned={[1, 2, 3]}
			/>,
		);

		const writeNext = screen.getByText("+ 다음 화").closest("a");
		expect(writeNext).toHaveAttribute("href", "/chapters/2?action=write");
	});
});
