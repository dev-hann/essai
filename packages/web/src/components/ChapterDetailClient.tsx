"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui.js";
import { Markdown } from "@/components/Markdown.js";
import { DiffView } from "@/components/DiffView.js";
import { Tabs } from "@/components/Tabs.js";

type ReviewData = {
	feedback: string;
	aiTells: string[];
	issues: string[];
	needsFix: boolean;
} | null;

type WriteState =
	| { kind: "idle" }
	| { kind: "writing"; output: string }
	| { kind: "done"; output: string; wordCount: number }
	| { kind: "error"; message: string };

interface ChapterDetailClientProps {
	projectId: string;
	number: number;
	initialContent: string;
	wordCount: number;
	title: string | null;
	planned: boolean;
	initialAction: "write" | null;
}

export function ChapterDetailClient({
	projectId,
	number,
	initialContent,
	wordCount: initialWordCount,
	title,
	planned,
	initialAction,
}: ChapterDetailClientProps) {
	const apiBase = `/api/projects/${projectId}`;
	const router = useRouter();
	const [tab, setTab] = useState<"read" | "review" | "compare">(
		initialAction === "write" && !initialContent ? "review" : "read",
	);
	const [content, setContent] = useState(initialContent);
	const [wordCount, setWordCount] = useState(initialWordCount);
	const [instruction, setInstruction] = useState("");
	const [review, setReview] = useState<ReviewData>(null);
	const [reviewBusy, setReviewBusy] = useState(false);
	const [reviewError, setReviewError] = useState<string | null>(null);
	const [rewrite, setRewrite] = useState<WriteState>({ kind: "idle" });
	const [restoreBusy, setRestoreBusy] = useState(false);
	const [originalForCompare, setOriginalForCompare] = useState<string | null>(
		null,
	);
	const abortRef = useRef<AbortController | null>(null);

	const refreshSidebar = useCallback(() => {
		window.dispatchEvent(new CustomEvent("essai:refresh-sidebar"));
	}, []);

	const startStream = useCallback(
		async (endpoint: string, body: Record<string, unknown>) => {
			if (rewrite.kind === "writing") return;
			setRewrite({ kind: "writing", output: "" });
			setTab("review");
			const controller = new AbortController();
			abortRef.current = controller;
			try {
				const res = await fetch(endpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "text/event-stream",
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				});
				if (!res.ok || !res.body) {
					const text = await res.text().catch(() => "");
					throw new Error(text || `요청 실패 (${res.status})`);
				}
				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";
				let collected = "";
				let finalWordCount: number | null = null;
				for (;;) {
					const { value, done } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const events = buffer.split("\n\n");
					buffer = events.pop() ?? "";
					for (const evt of events) {
						const parsed = parseSse(evt);
						if (!parsed) continue;
						if (parsed.event === "token") {
							const delta =
								typeof parsed.data === "string"
									? parsed.data
									: (parsed.data as { delta?: string })
											.delta ?? "";
							collected += delta;
							setRewrite({ kind: "writing", output: collected });
						} else if (parsed.event === "saved") {
							const wc = (
								parsed.data as { wordCount?: number }
							).wordCount;
							if (typeof wc === "number") finalWordCount = wc;
						} else if (parsed.event === "error") {
							const message = (
								parsed.data as { message?: string }
							).message ?? "알 수 없는 오류";
							throw new Error(message);
						}
					}
				}
				setRewrite({
					kind: "done",
					output: collected,
					wordCount: finalWordCount ?? collected.length,
				});
				setOriginalForCompare(content);
				setContent(collected);
				setWordCount(finalWordCount ?? collected.length);
				setTab("compare");
				refreshSidebar();
				router.refresh();
			} catch (err) {
				if ((err as Error).name === "AbortError") {
					setRewrite({ kind: "idle" });
					return;
				}
				setRewrite({
					kind: "error",
					message: err instanceof Error ? err.message : String(err),
				});
			} finally {
				abortRef.current = null;
			}
		},
		[rewrite.kind, content, refreshSidebar, router],
	);

	const onWrite = useCallback(() => {
		if (!planned) return;
		void startStream(`${apiBase}/chapters/${number}/write`, {
			...(instruction ? { instruction } : {}),
		});
	}, [planned, number, instruction, startStream, apiBase]);

	const onRewrite = useCallback(() => {
		void startStream(`${apiBase}/chapters/${number}/rewrite`, {
			...(instruction ? { instruction } : {}),
		});
	}, [number, instruction, startStream, apiBase]);

	const onReview = useCallback(async () => {
		setReviewBusy(true);
		setReviewError(null);
		try {
			const res = await fetch(`${apiBase}/chapters/${number}/review`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			if (!res.ok) {
				const text = await res.text().catch(() => "");
				throw new Error(text || `리뷰 실패 (${res.status})`);
			}
			const data = (await res.json()) as {
				feedback: string;
				aiTells: string[];
				issues: string[];
				needsFix: boolean;
			};
			setReview(data);
		} catch (err) {
			setReviewError(err instanceof Error ? err.message : String(err));
		} finally {
			setReviewBusy(false);
		}
	}, [number, apiBase]);

	const onCancel = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	useEffect(() => {
		return () => abortRef.current?.abort();
	}, []);

	return (
		<div className="max-w-4xl mx-auto p-8">
			<header className="mb-6">
				<h1 className="text-xl font-semibold">
					{number}화{title ? `: ${title}` : ""}
				</h1>
				<p className="text-[12px] text-[var(--color-text-mute)] mt-1">
					{content
						? `${wordCount.toLocaleString()}자`
						: planned
							? "아직 작성되지 않음"
							: "Bible에 챕터 계획이 없음"}
				</p>
			</header>

			<Tabs
				tabs={[
					{ id: "read", label: "읽기" },
					{ id: "review", label: "리뷰 & 수정" },
					{
						id: "compare",
						label: "비교",
						disabled: originalForCompare === null,
					},
				]}
				active={tab}
				onChange={(id) => setTab(id as typeof tab)}
			/>

			{tab === "read" && (
				<div className="pt-6">
					{content ? (
						<Markdown>{content}</Markdown>
					) : (
						<div className="text-[13px] text-[var(--color-text-mute)] py-8 text-center">
							이 챕터는 아직 작성되지 않았습니다.
							{planned && (
								<div className="mt-3">
									<Button variant="primary" onClick={onWrite}>
										작성 시작
									</Button>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{tab === "review" && (
				<div className="pt-6 grid gap-4">
					<section className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)]">
						<div className="flex items-center justify-between mb-2">
							<h3 className="text-[13px] font-semibold">
								AI 리뷰
							</h3>
							<Button
								variant="primary"
								onClick={onReview}
								disabled={reviewBusy || !content}
							>
								{reviewBusy ? "리뷰 중…" : "AI 피드백 받기"}
							</Button>
						</div>
						{reviewError && (
							<div className="text-[12px] text-[var(--color-danger)]">
								{reviewError}
							</div>
						)}
						{review && (
							<div className="mt-3 space-y-3">
								<Markdown>{review.feedback}</Markdown>
								{review.aiTells.length > 0 && (
									<details className="text-[12px] text-[var(--color-warning)]">
										<summary className="cursor-pointer">
											AI 감지 표현 ({review.aiTells.length})
										</summary>
										<ul className="mt-1 list-disc pl-5">
											{review.aiTells.map((t, i) => (
												<li key={i}>{t}</li>
											))}
										</ul>
									</details>
								)}
								{review.issues.length > 0 && (
									<details className="text-[12px] text-[var(--color-text-dim)]">
										<summary className="cursor-pointer">
											발견된 이슈 ({review.issues.length})
										</summary>
										<ul className="mt-1 list-disc pl-5">
											{review.issues.map((t, i) => (
												<li key={i}>{t}</li>
											))}
										</ul>
									</details>
								)}
								{review.needsFix && (
									<div className="text-[11px] text-[var(--color-warning)]">
										수정이 권장됩니다.
									</div>
								)}
							</div>
						)}
					</section>

					<section className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)]">
						<h3 className="text-[13px] font-semibold mb-2">
							수정 지시
						</h3>
						<textarea
							value={instruction}
							onChange={(e) => setInstruction(e.target.value)}
							placeholder="예: 대사를 더 늘려줘"
							rows={3}
							className="w-full"
						/>
						<div className="flex gap-2 mt-2">
							{!content && planned && (
								<Button
									variant="primary"
									onClick={onWrite}
									disabled={rewrite.kind === "writing"}
								>
									작성
								</Button>
							)}
							{content && (
								<Button
									variant="primary"
									onClick={onRewrite}
									disabled={rewrite.kind === "writing"}
								>
									{rewrite.kind === "writing"
										? "재생성 중…"
										: "재생성"}
								</Button>
							)}
							{rewrite.kind === "writing" && (
								<Button variant="danger" onClick={onCancel}>
									중단
								</Button>
							)}
						</div>
					</section>

					{rewrite.kind === "writing" && (
						<section className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)]">
							<h3 className="text-[13px] font-semibold mb-2">
								실시간 출력
							</h3>
							<pre className="whitespace-pre-wrap text-[12px] font-mono max-h-96 overflow-auto scrollbar">
								{rewrite.output || "…"}
							</pre>
						</section>
					)}

					{rewrite.kind === "error" && (
						<div className="text-[12px] text-[var(--color-danger)] border border-[var(--color-danger)] rounded p-3">
							{rewrite.message}
						</div>
					)}

					{rewrite.kind === "done" && (
						<div className="text-[12px] text-[var(--color-success)]">
							재생성 완료 ({rewrite.wordCount.toLocaleString()}자).
							비교 탭을 확인하세요.
						</div>
					)}
				</div>
			)}

			{tab === "compare" && originalForCompare !== null && (
				<div className="pt-6 grid gap-3">
					<DiffView before={originalForCompare} after={content} />
					<div className="flex gap-2 justify-end">
						<Button
							variant="danger"
							disabled={restoreBusy}
							onClick={async () => {
								if (!originalForCompare) return;
								setRestoreBusy(true);
								try {
									const res = await fetch(
										`${apiBase}/chapters/${number}`,
										{
											method: "POST",
											headers: {
												"Content-Type": "application/json",
											},
											body: JSON.stringify({
												content: originalForCompare,
											}),
										},
									);
									if (!res.ok) {
										throw new Error(
											`복원 실패 (${res.status})`,
										);
									}
									setContent(originalForCompare);
									setWordCount(originalForCompare.length);
									setOriginalForCompare(null);
									setTab("read");
									refreshSidebar();
									router.refresh();
								} catch (err) {
									setRewrite({
										kind: "error",
										message:
											err instanceof Error
												? err.message
												: String(err),
									});
								} finally {
									setRestoreBusy(false);
								}
							}}
						>
							{restoreBusy ? "복원 중…" : "원본 유지"}
						</Button>
						<Button
							variant="primary"
							onClick={() => {
								setOriginalForCompare(null);
								setTab("read");
							}}
						>
							채택
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function parseSse(
	chunk: string,
): { event: string; data: unknown } | null {
	const lines = chunk.split("\n");
	let event: string | null = null;
	const dataParts: string[] = [];
	for (const line of lines) {
		if (line.startsWith("event:")) {
			event = line.slice("event:".length).trim();
		} else if (line.startsWith("data:")) {
			dataParts.push(line.slice("data:".length).trim());
		}
	}
	if (event === null) return null;
	const dataStr = dataParts.join("\n");
	let data: unknown = dataStr;
	try {
		data = JSON.parse(dataStr);
	} catch {
		// keep raw string
	}
	return { event, data };
}
