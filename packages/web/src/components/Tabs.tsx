"use client";

import type { ReactNode } from "react";

export interface TabSpec {
	id: string;
	label: string;
	disabled?: boolean;
}

interface TabsProps {
	tabs: TabSpec[];
	active: string;
	onChange: (id: string) => void;
	children?: ReactNode;
}

export function Tabs({ tabs, active, onChange, children }: TabsProps) {
	return (
		<div>
			<div className="flex border-b border-[var(--color-border)]">
				{tabs.map((tab) => {
					const isActive = tab.id === active;
					const isDisabled = tab.disabled;
					return (
						<button
							type="button"
							key={tab.id}
							disabled={isDisabled}
							onClick={() => !isDisabled && onChange(tab.id)}
							className={`px-4 py-2 text-[13px] border-b-2 -mb-px transition-colors ${
								isActive
									? "border-[var(--color-accent)] text-[var(--color-text)]"
									: "border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
							} ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
						>
							{tab.label}
						</button>
					);
				})}
			</div>
			{children ? <div className="pt-4">{children}</div> : null}
		</div>
	);
}
