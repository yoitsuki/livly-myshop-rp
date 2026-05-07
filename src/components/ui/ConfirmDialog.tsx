"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";

export type ConfirmVariant = "danger" | "primary";

export interface ConfirmDialogProps {
  open: boolean;
  message: ReactNode;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  busy?: boolean;
}

const VARIANT_BTN: Record<ConfirmVariant, string> = {
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
  primary: "bg-[var(--color-gold-deep)] text-white hover:opacity-90",
};

export default function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel = "CANCEL",
  variant = "danger",
  busy = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  const finalConfirmLabel =
    confirmLabel ?? (variant === "danger" ? "DELETE" : "OK");

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-[var(--color-text)]/40 flex items-center justify-center p-5"
      onClick={busy ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white border border-[var(--color-line)] max-w-sm w-full p-5"
        style={{ borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="text-[var(--color-text)] leading-relaxed mb-5 whitespace-pre-line"
          style={{ fontFamily: "var(--font-body)", fontSize: 14 }}
        >
          {message}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-[var(--color-muted)] text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] transition-colors disabled:opacity-50"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "0.24em",
              borderRadius: 0,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`px-4 py-2 inline-flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-50 ${VARIANT_BTN[variant]}`}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "0.24em",
              borderRadius: 0,
            }}
          >
            {busy && (
              <Loader2 size={11} strokeWidth={2.4} className="animate-spin" />
            )}
            {finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
