"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";

type Tone = "success" | "info" | "warn";

export interface ToastProps {
  /** When true, the toast slides in from the bottom; flipping to false slides
   * it away. */
  open: boolean;
  message: string;
  tone?: Tone;
}

const ICON: Record<Tone, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
};

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-[var(--color-text)] text-white border border-[var(--color-text)]",
  info: "bg-[var(--color-text)] text-white border border-[var(--color-text)]",
  warn: "bg-[var(--color-danger)] text-white border border-[var(--color-danger)]",
};

/**
 * Bottom-anchored toast pill. Controlled — caller flips `open` and resets
 * after a timeout. Renders nothing the first time `open` is false so it
 * doesn't block any pointer events while idle.
 */
export default function Toast({ open, message, tone = "success" }: ToastProps) {
  const Icon = ICON[tone];
  // Mount once after first open so the slide-in plays.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 z-[60] inline-flex items-center gap-2 px-4 h-10 font-[var(--font-label)] text-[12px] tracking-[0.08em] font-medium tabular-nums transition-all duration-200 ease-out ${TONE_CLASS[tone]} ${
        open
          ? "bottom-6 opacity-100"
          : "bottom-2 opacity-0 pointer-events-none"
      }`}
      style={{ borderRadius: 0 }}
    >
      <Icon size={16} strokeWidth={1.8} aria-hidden />
      <span>{message}</span>
    </div>
  );
}
