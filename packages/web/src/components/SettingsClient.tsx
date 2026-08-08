"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui.js";

interface ConfigData {
	name: string;
	language: string;
	chapterWords: number;
	llm: {
		baseUrl: string;
		apiKey: string;
		model: string;
		temperature: number;
		maxTokens: number;
		thinkingEnabled: boolean;
	};
}

type Status = "loading" | "saving" | "saved" | "error" | "ready";

interface SettingsClientProps {
	projectId: string;
}

export function SettingsClient({ projectId }: SettingsClientProps) {
	const apiBase = `/api/projects/${projectId}`;
	const [data, setData] = useState<ConfigData | null>(null);
	const [status, setStatus] = useState<Status>("loading");
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(`${apiBase}/config`, { cache: "no-store" })
			.then(async (res) => {
				if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`);
				const json = (await res.json()) as ConfigData;
				if (cancelled) return;
				setData(json);
				setStatus("ready");
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setMessage(err instanceof Error ? err.message : String(err));
				setStatus("error");
			});
		return () => {
			cancelled = true;
		};
	}, [apiBase]);

	const onSave = async () => {
		if (!data) return;
		setStatus("saving");
		setMessage(null);
		try {
			const res = await fetch(`${apiBase}/config`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!res.ok) {
				const text = await res.text().catch(() => "");
				throw new Error(text || `저장 실패 (${res.status})`);
			}
			setStatus("saved");
			setMessage("저장되었습니다.");
		} catch (err) {
			setStatus("error");
			setMessage(err instanceof Error ? err.message : String(err));
		}
	};

	if (status === "loading" || !data) {
		return (
			<div className="max-w-2xl mx-auto p-8">
				<div className="text-[12px] text-[var(--color-text-mute)]">
					불러오는 중…
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto p-8">
			<header className="mb-6">
				<h1 className="text-xl font-semibold">설정</h1>
				<p className="text-[12px] text-[var(--color-text-mute)] mt-1">
					essai.json
				</p>
			</header>

			<div className="grid gap-4">
				<Field label="프로젝트 이름">
					<input
						type="text"
						value={data.name}
						onChange={(e) => setData({ ...data, name: e.target.value })}
					/>
				</Field>

				<Field label="언어">
					<select
						value={data.language}
						onChange={(e) => setData({ ...data, language: e.target.value })}
					>
						<option value="ko">한국어</option>
						<option value="en">English</option>
						<option value="ja">日本語</option>
						<option value="zh">中文</option>
					</select>
				</Field>

				<Field label="모델">
					<input
						type="text"
						value={data.llm.model}
						onChange={(e) =>
							setData({
								...data,
								llm: { ...data.llm, model: e.target.value },
							})
						}
					/>
				</Field>

				<Field label="Base URL">
					<input
						type="text"
						value={data.llm.baseUrl}
						onChange={(e) =>
							setData({
								...data,
								llm: { ...data.llm, baseUrl: e.target.value },
							})
						}
					/>
				</Field>

				<Field label="API Key" hint="빈 칸으로 두면 기존 값 유지">
					<input
						type="password"
						placeholder="••••••••••••"
						onChange={(e) =>
							setData({
								...data,
								llm: { ...data.llm, apiKey: e.target.value },
							})
						}
					/>
				</Field>

				<Field label="글자 수">
					<input
						type="number"
						min={500}
						max={20000}
						value={data.chapterWords}
						onChange={(e) =>
							setData({
								...data,
								chapterWords: Number(e.target.value) || 0,
							})
						}
					/>
				</Field>

				<Field label="Temperature">
					<input
						type="number"
						step={0.1}
						min={0}
						max={2}
						value={data.llm.temperature}
						onChange={(e) =>
							setData({
								...data,
								llm: {
									...data.llm,
									temperature: Number(e.target.value) || 0,
								},
							})
						}
					/>
				</Field>

				<Field label="Thinking">
					<label className="flex items-center gap-2 text-[13px]">
						<input
							type="checkbox"
							checked={data.llm.thinkingEnabled}
							onChange={(e) =>
								setData({
									...data,
									llm: {
										...data.llm,
										thinkingEnabled: e.target.checked,
									},
								})
							}
						/>
						<span>활성화</span>
					</label>
				</Field>

				<div className="flex items-center gap-3 mt-2">
					<Button
						variant="primary"
						onClick={onSave}
						disabled={status === "saving"}
					>
						{status === "saving" ? "저장 중…" : "저장"}
					</Button>
					{status === "saved" && (
						<span className="text-[12px] text-[var(--color-success)]">
							{message}
						</span>
					)}
					{status === "error" && (
						<span className="text-[12px] text-[var(--color-danger)]">
							{message}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<label className="grid grid-cols-[140px_1fr] gap-3 items-center">
			<div>
				<div className="text-[13px] text-[var(--color-text-dim)]">{label}</div>
				{hint && (
					<div className="text-[10px] text-[var(--color-text-mute)] mt-0.5">
						{hint}
					</div>
				)}
			</div>
			<div>{children}</div>
		</label>
	);
}
