"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui.js";

interface BibleFile {
	section: string;
	filename: string;
	content: string;
}

interface BibleClientProps {
	projectId: string;
	files: BibleFile[];
}

type ChatRole = "user" | "assistant";
interface ChatMessage {
	id: number;
	role: ChatRole;
	text: string;
	kind?: "message" | "saved" | "error";
}

export function BibleClient({ projectId, files }: BibleClientProps) {
	const apiBase = `/api/projects/${projectId}`;
	const [active, setActive] = useState(files[0]?.section ?? "characters");
	const [contents, setContents] = useState<Record<string, string>>(() => {
		const map: Record<string, string> = {};
		for (const f of files) map[f.section] = f.content;
		return map;
	});
	const [dirty, setDirty] = useState<Record<string, boolean>>({});
	const [saveState, setSaveState] = useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const [chatOpen, setChatOpen] = useState(false);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatHistory, setChatHistory] = useState<
		Array<{ role: "user" | "assistant"; content: string }>
	>([]);
	const [chatInput, setChatInput] = useState("");
	const [chatBusy, setChatBusy] = useState(false);
	const [chatFinished, setChatFinished] = useState(false);
	const msgId = useRef(0);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const chatEndRef = useRef<HTMLDivElement | null>(null);

	const current = files.find((f) => f.section === active) ?? null;

	const onChange = (value: string) => {
		if (!current) return;
		setContents((prev) => ({ ...prev, [current.section]: value }));
		setDirty((prev) => ({ ...prev, [current.section]: true }));
		setSaveState("idle");
	};

	const onSave = useCallback(async () => {
		if (!current) return;
		setSaveState("saving");
		try {
			const res = await fetch(`${apiBase}/bible/${current.section}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: contents[current.section] }),
			});
			if (!res.ok) {
				throw new Error(`저장 실패 (${res.status})`);
			}
			setDirty((prev) => ({ ...prev, [current.section]: false }));
			setSaveState("saved");
		} catch (err) {
			setSaveState("error");
			console.error(err);
		}
	}, [current, contents, apiBase]);

	const pushMessage = useCallback((msg: Omit<ChatMessage, "id">) => {
		msgId.current += 1;
		setChatMessages((prev) => [...prev, { ...msg, id: msgId.current }]);
	}, []);

	const handleAgentEvent = useCallback(
		(evt: AgentEvent) => {
			if (evt.event === "message") {
				pushMessage({
					role: "assistant",
					text: evt.data.text,
					kind: "message",
				});
			} else if (evt.event === "saved-file") {
				pushMessage({
					role: "assistant",
					text: `✓ ${evt.data.file} 저장 — ${evt.data.summary}`,
					kind: "saved",
				});
			} else if (evt.event === "done") {
				const data = evt.data as {
					finished?: boolean;
					history?: Array<{
						role: "user" | "assistant";
						content: string;
					}>;
				};
				if (data.history) setChatHistory(data.history);
				if (data.finished) {
					setChatFinished(true);
					pushMessage({
						role: "assistant",
						text: "세션이 종료되었습니다.",
						kind: "message",
					});
				}
			} else if (evt.event === "error") {
				pushMessage({
					role: "assistant",
					text: evt.data.message,
					kind: "error",
				});
			}
		},
		[pushMessage],
	);

	const startAgent = useCallback(async () => {
		setChatOpen(true);
		setChatMessages([]);
		setChatHistory([]);
		setChatFinished(false);
		setChatBusy(true);
		try {
			const res = await fetch(`${apiBase}/bible/agent`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "text/event-stream",
				},
				body: JSON.stringify({ message: null, history: [] }),
			});
			if (!res.ok || !res.body) {
				throw new Error(`Bible Agent 시작 실패 (${res.status})`);
			}
			await consumeAgentStream(res.body, handleAgentEvent);
		} catch (err) {
			pushMessage({
				role: "assistant",
				text: err instanceof Error ? err.message : String(err),
				kind: "error",
			});
		} finally {
			setChatBusy(false);
		}
	}, [handleAgentEvent, pushMessage, apiBase]);

	const sendUserMessage = useCallback(
		async (text: string) => {
			if (!text.trim() || chatBusy || chatFinished) return;
			pushMessage({ role: "user", text });
			const nextHistory = [
				...chatHistory,
				{ role: "user" as const, content: text },
			];
			setChatHistory(nextHistory);
			setChatInput("");
			setChatBusy(true);
			try {
				const res = await fetch(`${apiBase}/bible/agent`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "text/event-stream",
					},
					body: JSON.stringify({
						message: text,
						history: chatHistory,
					}),
				});
				if (!res.ok || !res.body) {
					throw new Error(`요청 실패 (${res.status})`);
				}
				await consumeAgentStream(res.body, handleAgentEvent);
			} catch (err) {
				pushMessage({
					role: "assistant",
					text: err instanceof Error ? err.message : String(err),
					kind: "error",
				});
			} finally {
				setChatBusy(false);
				requestAnimationFrame(() => {
					inputRef.current?.focus();
					chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
				});
			}
		},
		[
			chatBusy,
			chatFinished,
			chatHistory,
			handleAgentEvent,
			pushMessage,
			apiBase,
		],
	);

	return (
		<div className="max-w-5xl mx-auto p-8">
			<header className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-xl font-semibold">Bible</h1>
					<p className="text-[12px] text-[var(--color-text-mute)] mt-1">
						스토리 바이블 편집
					</p>
				</div>
				<Button
					variant="primary"
					onClick={() => {
						if (!chatOpen) void startAgent();
						else setChatOpen(false);
					}}
				>
					{chatOpen ? "채팅 닫기" : "AI 대화형으로 Bible 생성"}
				</Button>
			</header>

			<div
				className={`grid gap-4 ${chatOpen ? "lg:grid-cols-[1fr_360px]" : "grid-cols-1"}`}
			>
				<div>
					<div className="flex flex-wrap gap-1 mb-3">
						{files.map((f) => (
							<button
								type="button"
								key={f.section}
								onClick={() => setActive(f.section)}
								className={`px-3 py-1.5 rounded-md text-[12px] transition-colors border ${
									active === f.section
										? "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border-hover)]"
										: "bg-transparent text-[var(--color-text-dim)] border-transparent hover:text-[var(--color-text)]"
								}`}
							>
								{f.section}
								{dirty[f.section] ? (
									<span className="ml-1 text-[var(--color-warning)]">•</span>
								) : null}
							</button>
						))}
					</div>

					{current && (
						<div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
							<div className="flex items-center justify-between mb-2">
								<div className="text-[11px] text-[var(--color-text-mute)] font-mono">
									{current.filename}
								</div>
								<div className="flex items-center gap-2">
									{saveState === "saved" && (
										<span className="text-[11px] text-[var(--color-success)]">
											저장됨
										</span>
									)}
									{saveState === "error" && (
										<span className="text-[11px] text-[var(--color-danger)]">
											오류
										</span>
									)}
									<Button
										variant="primary"
										onClick={onSave}
										disabled={saveState === "saving" || !dirty[current.section]}
									>
										{saveState === "saving" ? "저장 중…" : "저장"}
									</Button>
								</div>
							</div>
							<textarea
								value={contents[current.section] ?? ""}
								onChange={(e) => onChange(e.target.value)}
								rows={24}
								className="w-full font-mono text-[12px]"
								spellCheck={false}
							/>
						</div>
					)}
				</div>

				{chatOpen && (
					<div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] flex flex-col h-[600px]">
						<div className="px-3 py-2 border-b border-[var(--color-border)] text-[12px] font-semibold">
							Bible Agent
						</div>
						<div className="flex-1 overflow-y-auto scrollbar p-3 space-y-2">
							{chatMessages.length === 0 && (
								<div className="text-[12px] text-[var(--color-text-mute)] text-center py-4">
									에이전트가 응답을 준비하고 있습니다…
								</div>
							)}
							{chatMessages.map((m) => (
								<div
									key={m.id}
									className={`text-[12px] leading-relaxed p-2 rounded ${
										m.role === "user"
											? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
											: m.kind === "saved"
												? "bg-[rgba(107,211,154,0.1)] text-[var(--color-success)]"
												: m.kind === "error"
													? "bg-[rgba(224,122,122,0.1)] text-[var(--color-danger)]"
													: "text-[var(--color-text-dim)]"
									}`}
								>
									{m.text}
								</div>
							))}
							<div ref={chatEndRef} />
						</div>
						<form
							className="border-t border-[var(--color-border)] p-2 flex gap-2"
							onSubmit={(e) => {
								e.preventDefault();
								void sendUserMessage(chatInput);
							}}
						>
							<input
								ref={inputRef}
								type="text"
								value={chatInput}
								onChange={(e) => setChatInput(e.target.value)}
								placeholder={chatFinished ? "세션 종료됨" : "답변 입력…"}
								disabled={chatBusy || chatFinished}
								className="flex-1"
							/>
							<Button
								type="submit"
								variant="primary"
								disabled={chatBusy || !chatInput.trim() || chatFinished}
							>
								전송
							</Button>
						</form>
					</div>
				)}
			</div>
		</div>
	);
}

type AgentEvent =
	| { event: "message"; data: { text: string } }
	| { event: "saved-file"; data: { file: string; summary: string } }
	| { event: "done"; data: Record<string, unknown> }
	| { event: "error"; data: { message: string } };

async function consumeAgentStream(
	body: ReadableStream<Uint8Array>,
	onEvent: (evt: AgentEvent) => void,
): Promise<void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const events = buffer.split("\n\n");
		buffer = events.pop() ?? "";
		for (const evt of events) {
			const parsed = parseSse(evt);
			if (!parsed) continue;
			onEvent(parsed as AgentEvent);
		}
	}
}

function parseSse(chunk: string): { event: string; data: unknown } | null {
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
