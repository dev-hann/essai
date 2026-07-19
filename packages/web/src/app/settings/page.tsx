"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";

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

const EMPTY: ConfigData = {
	name: "",
	language: "ko",
	chapterWords: 3000,
	llm: {
		baseUrl: "",
		apiKey: "",
		model: "",
		temperature: 0.7,
		maxTokens: 8000,
		thinkingEnabled: false,
	},
};

export default function SettingsPage() {
	const [config, setConfig] = useState<ConfigData>(EMPTY);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/config", { cache: "no-store" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as Partial<ConfigData>;
			setConfig({
				...EMPTY,
				...data,
				llm: { ...EMPTY.llm, ...(data.llm ?? {}) },
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "load failed");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const save = useCallback(async () => {
		setSaving(true);
		setError(null);
		setSaved(false);
		try {
			const res = await fetch("/api/config", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(config),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
			setSaved(true);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "save failed");
		} finally {
			setSaving(false);
		}
	}, [config, load]);

	const update = useCallback((patch: Partial<ConfigData>) => {
		setConfig((prev) => ({ ...prev, ...patch }));
	}, []);

	const updateLlm = useCallback((patch: Partial<ConfigData["llm"]>) => {
		setConfig((prev) => ({ ...prev, llm: { ...prev.llm, ...patch } }));
	}, []);

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 p-8">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="text-2xl font-semibold text-neutral-100">설정</h1>
				</div>

				{loading ? (
					<p className="text-sm text-neutral-400">불러오는 중…</p>
				) : (
					<form
						className="flex max-w-2xl flex-col gap-6"
						onSubmit={(e) => {
							e.preventDefault();
							void save();
						}}
					>
						{error ? <p className="text-sm text-red-400">{error}</p> : null}
						{saved ? (
							<p className="text-sm text-emerald-400">저장되었습니다.</p>
						) : null}

						<Field label="프로젝트 이름">
							<input
								type="text"
								value={config.name}
								onChange={(e) => update({ name: e.target.value })}
								className={inputClass}
							/>
						</Field>

						<Field label="언어">
							<select
								value={config.language}
								onChange={(e) => update({ language: e.target.value })}
								className={inputClass}
							>
								<option value="ko">한국어</option>
								<option value="en">English</option>
								<option value="ja">日本語</option>
							</select>
						</Field>

						<fieldset className="flex flex-col gap-4 rounded-md border border-neutral-800 p-4">
							<legend className="px-2 text-xs font-medium text-neutral-400">
								LLM
							</legend>
							<Field label="Base URL">
								<input
									type="url"
									value={config.llm.baseUrl}
									onChange={(e) => updateLlm({ baseUrl: e.target.value })}
									placeholder="https://api.openai.com/v1"
									className={inputClass}
								/>
							</Field>
							<Field label="API Key">
								<input
									type="password"
									value={config.llm.apiKey}
									onChange={(e) => updateLlm({ apiKey: e.target.value })}
									placeholder="sk-…"
									className={inputClass}
								/>
							</Field>
							<Field label="모델">
								<input
									type="text"
									value={config.llm.model}
									onChange={(e) => updateLlm({ model: e.target.value })}
									placeholder="gpt-4o"
									className={inputClass}
								/>
							</Field>
							<Field label="온도 (Temperature)">
								<input
									type="number"
									step="0.1"
									min="0"
									max="2"
									value={config.llm.temperature}
									onChange={(e) =>
										updateLlm({ temperature: Number(e.target.value) })
									}
									className={inputClass}
								/>
							</Field>
							<label className="flex items-center gap-2 text-sm text-neutral-300">
								<input
									type="checkbox"
									checked={config.llm.thinkingEnabled}
									onChange={(e) =>
										updateLlm({ thinkingEnabled: e.target.checked })
									}
									className="h-4 w-4 accent-neutral-100"
								/>
								Thinking 모드
							</label>
						</fieldset>

						<Field label="챕터당 목표 글자 수">
							<input
								type="number"
								min="100"
								step="100"
								value={config.chapterWords}
								onChange={(e) =>
									update({ chapterWords: Number(e.target.value) })
								}
								className={inputClass}
							/>
						</Field>

						<div>
							<button
								type="submit"
								disabled={saving}
								className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:opacity-50"
							>
								{saving ? "저장 중…" : "저장"}
							</button>
						</div>
					</form>
				)}
			</main>
		</div>
	);
}

const inputClass =
	"w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-xs text-neutral-400">{label}</span>
			{children}
		</div>
	);
}
