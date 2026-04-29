import type { HTMLAttributes, ReactNode } from "react";

type Tone = "mint" | "neutral" | "warn" | "info" | "muted";
type Variant = "solid" | "soft" | "outline";
type Size = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/**
 * Compact label chip. Use for short, non-interactive status indicators
 * (e.g. "保存済", "情報元: なんおし"). Period badges live separately because
 * their tier coloring is data-driven.
 */
const TONE: Record<Variant, Record<Tone, string>> = {
  solid: {
    mint: "bg-gold text-white",
    neutral: "bg-text text-white",
    warn: "bg-[#c46070] text-white",
    info: "bg-[#5b8fb9] text-white",
    muted: "bg-[var(--color-line-strong)] text-text",
  },
  soft: {
    mint: "bg-[var(--color-line-soft)] text-gold-deep",
    neutral: "bg-[var(--color-line-soft)] text-text",
    warn: "bg-[var(--color-danger-soft)] text-[#a04050]",
    info: "bg-sky text-text/80",
    muted: "bg-[var(--color-line-soft)] text-muted",
  },
  outline: {
    mint: "border border-gold text-gold-deep",
    neutral: "border border-[var(--color-line-strong)] text-text",
    warn: "border border-[#e9b9c0] text-[#a04050]",
    info: "border border-[#b9d8ec] text-text/80",
    muted: "border border-[var(--color-line)] text-muted",
  },
};

const SIZE: Record<Size, string> = {
  sm: "h-5 px-2 text-[10.5px]",
  md: "h-6 px-2.5 text-[11.5px]",
};

export default function Badge({
  tone = "mint",
  variant = "soft",
  size = "sm",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-md font-medium tabular-nums whitespace-nowrap leading-none",
        SIZE[size],
        TONE[variant][tone],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </span>
  );
}
