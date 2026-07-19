import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	children: ReactNode;
}

const variants: Record<Variant, string> = {
	primary:
		"bg-[var(--color-accent)] text-[#0d0f14] hover:bg-[var(--color-accent-hover)]",
	secondary:
		"bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[var(--color-border-hover)] border border-[var(--color-border)]",
	ghost:
		"bg-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
	danger:
		"bg-transparent text-[var(--color-danger)] border border-[var(--color-border)] hover:bg-[rgba(224,122,122,0.1)]",
};

export function Button({
	variant = "secondary",
	children,
	className = "",
	...rest
}: ButtonProps) {
	return (
		<button
			type="button"
			className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
			{...rest}
		>
			{children}
		</button>
	);
}

export function Card({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 ${className}`}
		>
			{children}
		</div>
	);
}

export function CardHeader({
	title,
	subtitle,
}: {
	title: string;
	subtitle?: string;
}) {
	return (
		<div className="mb-3">
			<h3 className="text-[13px] font-semibold text-[var(--color-text)]">
				{title}
			</h3>
			{subtitle ? (
				<p className="text-[11px] text-[var(--color-text-mute)] mt-0.5">
					{subtitle}
				</p>
			) : null}
		</div>
	);
}
