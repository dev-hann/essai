"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "../../../components/Sidebar";

interface ChapterData {
	number: number;
	content: string;
	wordCount: number;
}

interface ReviewData {
	feedback: string;
	aiTells: string[];
	issues: string[];
	needsFix: boolean;
}

type Tab = "read" | "review" | "compare";

interface StreamState {
	running: boolean;
	output: string;
	error: string | null;
}

async function streamSse(
	url: string,
	body: unknown,
	onToken: (delta: string) => void,
): Promise<{ done?: { content: string }; error?: string }> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok || !res.body) {
		const data = (await res.json().catch(() => ({}))) as { error?: string };
		return { error: data.error ?? `HTTP ${res.status}` };
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let doneContent: string | undefined;
	let errMsg: string | undefined;

	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		let sep: number;
		while ((sep = buffer.indexOf("\n\n")) >= 0) {
			const block = buffer.slice(0, sep);
			buffer = buffer.slice(sep + 2);
			let event = "message";
			const dataLines: string[] = [];
			for (const line of block.split("\n")) {
				if (line.startsWith("event:")) event = line.slice(6).trim();
				else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
			}
			const payload = dataLines.join("");
			if (!payload) continue;
			try {
				const parsed = JSON.parse(payload) as unknown;
				if (event === "token" && typeof parsed === "string") {
					onToken(parsed);
				} else if (event === "done" && typeof parsed === "object" && parsed) {
					doneContent = (parsed as { content?: string }).content;
				} else if (event === "error" && typeof parsed === "object" && parsed) {
					errMsg = (parsed as { message?: string }).message ?? "stream error";
				}
			} catch {
				// ignore malformed payloads
			}
		}
	}

	if (errMsg) return { error: errMsg };
	return doneContent !== undefined ? { done: { content: doneContent } } : {};
}

export default function ChapterDetailPage({
	params,
}: {
	params: Promise<{ n: string }>;
}) {
	const [number, setNumber] = useState<number | null>(null);
	useEffect(() => {
		void params.then((p) => setNumber(Number(p.n)));
	}, [params]);

	const [chapter, setChapter] = useState<ChapterData | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [tab, setTab] = useState<Tab>("read");

	const [review, setReview] = useState<ReviewData | null>(null);
	const [reviewing, setReviewing] = useState(false);

	const [instruction, setInstruction] = useState("");
	const [rewrite, setRewrite] = useState<StreamState>({
		running: false,
		output: "",
		error: null,
	});
	const [originalForCompare, setOriginalForCompare] = useState<string | null>(
		null,
	);
	const tabRef = useRef<Tab>(tab);
	tabRef.current = tab;

	const loadChapter = useCallback(async (n: number) => {
		try {
			const res = await fetch(`/api/chapters/${n}`, { cache: "no-store" });
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
			setChapter((await res.json()) as ChapterData);
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : "load failed");
		}
	}, []);

	useEffect(() => {
		if (number !== null) void loadChapter(number);
	}, [number, loadChapter]);

	const runReview = useCallback(async () => {
		if (number === null) return;
		setReviewing(true);
		setReview(null);
		try {
			const res = await fetch(`/api/chapters/${number}/review`, {
				method: "POST",
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
			setReview((await res.json()) as ReviewData);
		} catch (err) {
			setReview({
				feedback: err instanceof Error ? err.message : "review failed",
				aiTells: [],
				issues: [],
				needsFix: false,
			});
		} finally {
			setReviewing(false);
		}
	}, [number]);

	const runRewrite = useCallback(async () => {
		if (number === null || chapter === null) return;
		setRewrite({ running: true, output: "", error: null });
		setOriginalForCompare(chapter.content);
		const result = await streamSse(
			`/api/chapters/${number}/rewrite`,
			instruction.trim() ? { instruction } : {},
			(delta) =>
				setRewrite((prev) => ({ ...prev, output: prev.output + delta })),
		);
		if (result.error) {
			setRewrite((prev) => ({
				...prev,
				running: false,
				error: result.error ?? null,
			}));
		} else {
			setRewrite((prev) => ({ ...prev, running: false, error: null }));
			setTab("compare");
		}
	}, [number, chapter, instruction]);

	const acceptRewrite = useCallback(async () => {
		if (number === null || !rewrite.output) return;
		const res = await fetch(`/api/chapters/${number}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: rewrite.output }),
		});
		if (res.ok) {
			setRewrite({ running: false, output: "", error: null });
			setOriginalForCompare(null);
			setTab("read");
			await loadChapter(number);
		}
	}, [number, rewrite.output, loadChapter]);

	const rejectRewrite = useCallback(() => {
		setRewrite({ running: false, output: "", error: null });
		setOriginalForCompare(null);
		setTab("review");
	}, []);

	if (number === null) {
		return (
			<div className="flex min-h-screen">
				<Sidebar />
				<main className="flex-1 p-8">
					<p className="text-sm text-neutral-400">불러오는 중…</p>
				</main>
			</div>
		);
	}

	if (loadError) {
		return (
			<div className="flex min-h-screen">
				<Sidebar />
				<main className="flex-1 p-8">
					<p className="text-sm text-red-400">{loadError}</p>
				</main>
			</div>
		);
	}

	const tabs: readonly { id: Tab; label: string }[] = [
		{ id: "read", label: "읽기" },
		{ id: "review", label: "리뷰" },
		{ id: "compare", label: "비교" },
	];

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 p-8">
				<header className="mb-6 flex items-baseline justify-between">
					<h1 className="text-2xl font-semibold text-neutral-100">
						{number.toString().padStart(3, "0")}화
						{chapter ? (
							<span className="ml-3 text-sm font-normal text-neutral-500">
								{chapter.wordCount.toLocaleString()}자
							</span>
						) : null}
					</h1>
				</header>

				<nav className="mb-4 flex gap-1 border-b border-neutral-800">
					{tabs.map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => setTab(t.id)}
							disabled={t.id === "compare" && !rewrite.output}
							className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
								tab === t.id
									? "border-neutral-100 text-neutral-100"
									: "border-transparent text-neutral-400 hover:text-neutral-200 disabled:opacity-40"
							}`}
						>
							{t.label}
						</button>
					))}
				</nav>

				{tab === "read" && chapter ? (
					<article className="whitespace-pre-wrap break-words font-serif leading-loose text-neutral-200">
						{chapter.content || "(빈 챕터)"}
					</article>
				) : null}

				{tab === "review" ? (
					<section className="flex flex-col gap-4">
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => void runReview()}
								disabled={reviewing}
								className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:opacity-50"
							>
								{reviewing ? "리뷰 중…" : "AI 리뷰"}
							</button>
						</div>

						{review ? (
							<div className="flex flex-col gap-3">
								{review.aiTells.length > 0 ? (
									<div className="rounded-md border border-amber-700/50 bg-amber-950/30 p-3">
										<div className="mb-1 text-xs font-medium text-amber-400">
											AI 흔적
										</div>
										<div className="flex flex-wrap gap-1">
											{review.aiTells.map((t) => (
												<span
													key={t}
													className="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-200"
												>
													{t}
												</span>
											))}
										</div>
									</div>
								) : null}

								{review.needsFix ? (
									<div className="text-xs text-amber-400">
										수정 권장{review.issues.length > 0
											? ` (${review.issues.length}개 이슈)`
											: ""}
									</div>
								) : null}

								<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
									<div className="mb-2 text-xs font-medium text-neutral-400">
										피드백
									</div>
									<p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
										{review.feedback}
									</p>
								</div>
							</div>
						) : null}

						<div className="flex flex-col gap-2">
							<label
								htmlFor="rewrite-instruction"
								className="text-xs text-neutral-400"
							>
								수정 지시어
							</label>
							<textarea
								id="rewrite-instruction"
								value={instruction}
								onChange={(e) => setInstruction(e.target.value)}
								rows={4}
								placeholder="예: 첫 번째 장면의 대화를 더 자연스럽게."
								className="w-full resize-y rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
							/>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => void runRewrite()}
									disabled={rewrite.running || !chapter}
									className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:opacity-50"
								>
									{rewrite.running ? "재생성 중…" : "재생성"}
								</button>
								{rewrite.error ? (
									<span className="self-center text-xs text-red-400">
										{rewrite.error}
									</span>
								) : null}
							</div>
						</div>

						{rewrite.running || rewrite.output ? (
							<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
								<div className="mb-2 text-xs font-medium text-neutral-400">
									스트림{rewrite.running ? " ·" : ""}
								</div>
								<p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
									{rewrite.output}
									{rewrite.running ? (
										<span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-neutral-400 align-middle" />
									) : null}
								</p>
							</div>
						) : null}
					</section>
				) : null}

				{tab === "compare" && rewrite.output ? (
					<section className="flex flex-col gap-3">
						<div className="grid flex-1 grid-cols-2 gap-4">
							<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
								<div className="mb-2 text-xs font-medium text-neutral-400">
									원본
								</div>
								<p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
									{originalForCompare ?? chapter?.content ?? ""}
								</p>
							</div>
							<div className="rounded-md border border-emerald-800/40 bg-emerald-950/20 p-4">
								<div className="mb-2 text-xs font-medium text-emerald-400">
									새 버전
								</div>
								<p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-100">
									{rewrite.output}
								</p>
							</div>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => void acceptRewrite()}
								className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
							>
								수락
							</button>
							<button
								type="button"
								onClick={rejectRewrite}
								className="rounded-md border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
							>
								거절
							</button>
						</div>
					</section>
				) : null}
			</main>
		</div>
	);
}
