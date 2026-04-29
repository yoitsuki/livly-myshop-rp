import type { ReactNode } from "react";

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  /** Optional adornment shown next to the label (e.g. an "auto" badge). */
  labelAdornment?: ReactNode;
  /** Whether to show a small "*" required marker next to the label. */
  required?: boolean;
  children: ReactNode;
}

/**
 * Form field shell: label above + control below + optional hint / error.
 * The control itself owns its visual border (see `inputClass` below).
 */
export default function Field({
  label,
  hint,
  error,
  htmlFor,
  labelAdornment,
  required,
  children,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      {(label || labelAdornment) && (
        <div className="flex items-center gap-1.5 px-1">
          {label && (
            <label
              htmlFor={htmlFor}
              className="text-[11px] font-medium tracking-[0.06em] uppercase text-muted"
            >
              {label}
              {required && (
                <span className="text-gold-deep ml-1" aria-label="必須">
                  *
                </span>
              )}
            </label>
          )}
          {labelAdornment}
        </div>
      )}
      {children}
      {error ? (
        <div className="px-1 text-[11px] text-[var(--color-danger)]">
          {error}
        </div>
      ) : hint ? (
        <div className="px-1 text-[11px] text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

/**
 * Compute the className for a raw <input> / <select> / <textarea> inside a
 * Field. Accepts tone overrides:
 *   - `highlighted: true` → mint border (used to mark OCR auto-filled values)
 *   - `error: true`       → danger border
 *   - `multiline: true`   → drops the fixed h-11 (use for textareas)
 *
 * Designed so the rendered class always carries the focus ring rules; only
 * the resting border color changes.
 */
export interface InputClassOpts {
  highlighted?: boolean;
  error?: boolean;
  multiline?: boolean;
  /**
   * When false, the returned className omits `w-full` so the caller can size
   * the control via flex / explicit width utilities (default true).
   */
  fullWidth?: boolean;
}

export function inputClass(opts?: InputClassOpts): string {
  const { highlighted, error, multiline, fullWidth = true } = opts ?? {};
  const borderColor = error
    ? "border-[var(--color-danger)]"
    : highlighted
      ? "border-gold"
      : "border-[var(--color-line)]";
  const sizing = multiline ? "py-2" : "h-11";
  const width = fullWidth ? "w-full" : "";
  return [
    width,
    "bg-white border",
    borderColor,
    "rounded-md px-3",
    sizing,
    "text-[14px] text-text placeholder:text-muted/80 outline-none",
    "transition-all duration-150 ease-out",
    "focus:border-gold focus:shadow-[var(--shadow-focus)]",
    "disabled:bg-[var(--color-line-soft)] disabled:text-muted",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Default-state input className (no highlighted / error tone). */
export const fieldInputClass = inputClass();

/** Default-state textarea className. */
export const fieldTextareaClass = inputClass({ multiline: true });
