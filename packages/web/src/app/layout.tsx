import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/SidebarClient.js";
import "./globals.css";

export const metadata: Metadata = {
	title: "Essai",
	description: "AI writing tool where the author holds the pencil.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="ko">
			<body>
				<div className="flex min-h-screen">
					<Sidebar />
					<main className="flex-1 min-w-0 overflow-x-hidden">
						{children}
					</main>
				</div>
			</body>
		</html>
	);
}
