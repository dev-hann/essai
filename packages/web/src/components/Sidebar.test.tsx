import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarContent } from "@/components/Sidebar.js";

const noop = () => {};

describe("SidebarContent", () => {
	it("renders the four primary nav links scoped to the project", () => {
		render(
			<SidebarContent
				pathname="/p/abc"
				projectId="abc"
				projects={[{ id: "abc", name: "Alpha" }]}
				chapters={[]}
				planned={[]}
				onProjectChange={noop}
			/>,
		);

		const nav = screen.getByRole("navigation");
		const links = within(nav).getAllByRole("link");
		const hrefs = links.map((l) => l.getAttribute("href"));

		expect(hrefs).toContain("/p/abc");
		expect(hrefs).toContain("/p/abc/chapters");
		expect(hrefs).toContain("/p/abc/bible");
		expect(hrefs).toContain("/p/abc/settings");
	});

	it("renders nav labels with icons", () => {
		render(
			<SidebarContent
				pathname="/p/abc"
				projectId="abc"
				projects={[{ id: "abc", name: "Alpha" }]}
				chapters={[]}
				planned={[]}
				onProjectChange={noop}
			/>,
		);

		const nav = screen.getByRole("navigation");
		const labels = within(nav)
			.getAllByRole("link")
			.map((l) => l.textContent ?? "");

		expect(labels).toContain("📊대시보드");
		expect(labels).toContain("📖챕터");
		expect(labels).toContain("📓Bible");
		expect(labels).toContain("⚙️설정");
	});

	it("marks the matching nav item active based on pathname", () => {
		render(
			<SidebarContent
				pathname="/p/abc/bible"
				projectId="abc"
				projects={[{ id: "abc", name: "Alpha" }]}
				chapters={[]}
				planned={[]}
				onProjectChange={noop}
			/>,
		);

		const bibleLink = screen.getByText("Bible").closest("a");
		expect(bibleLink).not.toBeNull();
		expect(bibleLink?.className).toMatch(/bg-\[var\(--color-surface-2\)\]/);
	});

	it("lists both planned and written chapters sorted by number", () => {
		render(
			<SidebarContent
				pathname="/p/abc"
				projectId="abc"
				projects={[{ id: "abc", name: "Alpha" }]}
				chapters={[
					{ number: 3, wordCount: 1200, written: true },
					{ number: 1, wordCount: 900, written: true },
				]}
				planned={[1, 2, 3, 4]}
				onProjectChange={noop}
			/>,
		);

		expect(screen.getByText(/1화/)).toBeInTheDocument();
		expect(screen.getByText(/2화/)).toBeInTheDocument();
		expect(screen.getByText(/3화/)).toBeInTheDocument();
		expect(screen.getByText(/4화/)).toBeInTheDocument();
	});

	it("renders the empty state when no chapters are planned or written", () => {
		render(
			<SidebarContent
				pathname="/p/abc"
				projectId="abc"
				projects={[{ id: "abc", name: "Alpha" }]}
				chapters={[]}
				planned={[]}
				onProjectChange={noop}
			/>,
		);

		expect(screen.getByText("계획된 챕터가 없습니다.")).toBeInTheDocument();
	});

	it("renders the write-next button pointing at the first unwritten chapter", () => {
		render(
			<SidebarContent
				pathname="/p/abc"
				projectId="abc"
				projects={[{ id: "abc", name: "Alpha" }]}
				chapters={[{ number: 1, wordCount: 800, written: true }]}
				planned={[1, 2, 3]}
				onProjectChange={noop}
			/>,
		);

		const writeNext = screen.getByText("+ 다음 화").closest("a");
		expect(writeNext).toHaveAttribute("href", "/p/abc/chapters/2?action=write");
	});

	it("renders the project switcher with the provided projects", () => {
		const onChange = vi.fn();
		render(
			<SidebarContent
				pathname="/p/abc"
				projectId="abc"
				projects={[
					{ id: "abc", name: "Alpha" },
					{ id: "xyz", name: "Xyz" },
				]}
				chapters={[]}
				planned={[]}
				onProjectChange={onChange}
			/>,
		);

		const select = screen.getByRole("combobox") as HTMLSelectElement;
		expect(select.value).toBe("abc");
		expect(Array.from(select.options).map((o) => o.value)).toEqual([
			"abc",
			"xyz",
		]);
	});

	it("links the logo back to the home page", () => {
		render(
			<SidebarContent
				pathname="/p/abc"
				projectId="abc"
				projects={[{ id: "abc", name: "Alpha" }]}
				chapters={[]}
				planned={[]}
				onProjectChange={noop}
			/>,
		);

		const logo = screen.getByText("Essai").closest("a");
		expect(logo).toHaveAttribute("href", "/");
	});
});
