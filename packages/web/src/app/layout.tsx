import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Essai",
	description: "AI writing tool where the author holds the pencil.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="ko" className="dark">
			<body className="font-sans bg-neutral-950 text-neutral-200 antialiased">
				{children}
			</body>
		</html>
	);
}
