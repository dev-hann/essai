"use client";

import { useState } from "react";
import { Button } from "@/components/ui.js";

interface ExportButtonProps {
	projectId: string;
	label?: string;
}

export function ExportButton({
	projectId,
	label = "전체 내보내기",
}: ExportButtonProps) {
	const apiBase = `/api/projects/${projectId}`;
	const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
		"idle",
	);
	const [message, setMessage] = useState<string | null>(null);

	async function onClick() {
		setStatus("working");
		setMessage(null);
		try {
			const res = await fetch(`${apiBase}/export`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ format: "md" }),
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `export failed (${res.status})`);
			}
			const data = (await res.json()) as {
				path: string;
				chapterCount: number;
			};
			setMessage(`${data.chapterCount}개 챕터 → ${data.path}`);
			setStatus("done");
		} catch (err) {
			setMessage(err instanceof Error ? err.message : String(err));
			setStatus("error");
		}
	}

	return (
		<div className="inline-flex flex-col gap-1">
			<Button
				variant="secondary"
				onClick={onClick}
				disabled={status === "working"}
			>
				{status === "working" ? "내보내는 중…" : label}
			</Button>
			{message && (
				<span
					className={`text-[11px] ${status === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-text-mute)]"}`}
				>
					{message}
				</span>
			)}
		</div>
	);
}
