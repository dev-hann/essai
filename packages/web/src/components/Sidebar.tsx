import Link from "next/link";

type NavItem = {
	href: string;
	label: string;
};

const NAV_ITEMS: readonly NavItem[] = [
	{ href: "/", label: "대시보드" },
	{ href: "/chapters", label: "챕터" },
	{ href: "/bible", label: "바이블" },
	{ href: "/settings", label: "설정" },
] as const;

export default function Sidebar() {
	return (
		<aside className="w-60 shrink-0 border-r border-neutral-800 bg-neutral-900 p-4">
			<div className="mb-6 px-2 text-lg font-semibold tracking-tight text-neutral-100">
				Essai
			</div>
			<nav className="flex flex-col gap-1">
				{NAV_ITEMS.map((item) => (
					<Link
						key={item.href}
						href={item.href}
						className="rounded-md px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
					>
						{item.label}
					</Link>
				))}
			</nav>
		</aside>
	);
}
