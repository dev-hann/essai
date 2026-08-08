import { diffLines, diffWords } from "diff";

interface DiffViewProps {
	before: string;
	after: string;
}

export function DiffView({ before, after }: DiffViewProps) {
	const lineParts = diffLines(before, after);
	const wordParts = diffWords(before, after);

	const leftLines: React.ReactNode[] = [];
	const rightLines: React.ReactNode[] = [];

	for (const part of lineParts) {
		const lines = part.value.split("\n");
		if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
		for (const line of lines) {
			if (part.added) {
				leftLines.push(
					<div key={`l-${leftLines.length}`} className="diff-empty">
						&nbsp;
					</div>,
				);
				rightLines.push(
					<div key={`r-${rightLines.length}`} className="diff-line-add">
						{line || "\u00A0"}
					</div>,
				);
			} else if (part.removed) {
				leftLines.push(
					<div key={`l-${leftLines.length}`} className="diff-line-del">
						{line || "\u00A0"}
					</div>,
				);
				rightLines.push(
					<div key={`r-${rightLines.length}`} className="diff-empty">
						&nbsp;
					</div>,
				);
			} else {
				leftLines.push(
					<div key={`l-${leftLines.length}`} className="diff-line">
						{line || "\u00A0"}
					</div>,
				);
				rightLines.push(
					<div key={`r-${rightLines.length}`} className="diff-line">
						{line || "\u00A0"}
					</div>,
				);
			}
		}
	}

	return (
		<div className="grid grid-cols-2 gap-3">
			<div>
				<div className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)] mb-1">
					원본
				</div>
				<pre className="diff-pane">{leftLines}</pre>
			</div>
			<div>
				<div className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)] mb-1">
					수정본
				</div>
				<pre className="diff-pane">{rightLines}</pre>
			</div>
			<details className="col-span-2 text-[11px] text-[var(--color-text-mute)]">
				<summary className="cursor-pointer select-none">
					단어 단위 diff ({wordParts.length} segments)
				</summary>
				<pre className="diff-pane mt-2">
					{(() => {
						// diff segments are positional: identical strings (e.g.
						// whitespace runs) repeat, so a content-based key would
						// collide. Use a monotonic counter to give each span a
						// stable, unique key without an array index directly.
						let n = 0;
						return wordParts.map((p) => {
							n += 1;
							return (
								<span
									key={`seg-${n}-${p.added ? "a" : p.removed ? "r" : "k"}`}
									style={{
										backgroundColor: p.added
											? "rgba(77,138,106,0.18)"
											: p.removed
												? "rgba(160,90,90,0.18)"
												: "transparent",
										color: p.added
											? "var(--color-success)"
											: p.removed
												? "var(--color-danger)"
												: "inherit",
									}}
								>
									{p.value}
								</span>
							);
						});
					})()}
				</pre>
			</details>
			<style>{`
				.diff-pane {
					background-color: var(--color-surface);
					border: 1px solid var(--color-border);
					border-radius: 6px;
					padding: 8px 10px;
					margin: 0;
					font-family: ui-monospace, SFMono-Regular, monospace;
					font-size: 12px;
					line-height: 1.6;
					white-space: pre-wrap;
					word-break: break-word;
					max-height: 70vh;
					overflow: auto;
				}
				.diff-line, .diff-line-add, .diff-line-del, .diff-empty {
					padding: 0 4px;
					border-radius: 2px;
					min-height: 1.6em;
				}
				.diff-line-add {
					background-color: rgba(77,138,106,0.18);
					color: var(--color-success);
				}
				.diff-line-del {
					background-color: rgba(160,90,90,0.18);
					color: var(--color-danger);
				}
				.diff-empty {
					opacity: 0.25;
				}
			`}</style>
		</div>
	);
}
