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
  success: "bg-text text-white",
  info: "bg-text text-white",
  warn: "bg-[#7a3a44] text-white",
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
      className={`fixed left-1/2 -translate-x-1/2 z-[60] inline-flex items-center gap-2 px-4 h-10 rounded-md shadow-lg text-[13px] font-medium tabular-nums transition-all duration-200 ease-out ${TONE_CLASS[tone]} ${
        open
          ? "bottom-6 opacity-100"
          : "bottom-2 opacity-0 pointer-events-none"
      }`}
    >
      <Icon size={16} strokeWidth={2.2} aria-hidden />
      <span>{message}</span>
    </div>
  );
}
