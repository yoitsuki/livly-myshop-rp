import type { ReactNode } from "react";

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  /** Optional adornment shown next to the label (e.g. an "auto" badge). */
  labelAdornment?: ReactNode;
  children: ReactNode;
}

/**
 * Form field shell: label above + control below + optional hint / error.
 * The control itself owns its visual border (see `fieldInputClass` below).
 */
export default function Field({
  label,
  hint,
  error,
  htmlFor,
  labelAdornment,
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
 * Reusable className for raw <input> / <select> / <textarea> elements
 * inside a Field. Includes the hairline border, focus ring, and rounded
 * corners that make a control look "tappable".
 */
export const fieldInputClass =
  "w-full bg-white border border-[var(--color-line)] rounded-xl px-3 h-11 " +
  "text-[14px] text-text placeholder:text-muted/80 outline-none " +
  "transition-all duration-150 ease-out " +
  "focus:border-gold focus:shadow-[var(--shadow-focus)] " +
  "disabled:bg-[var(--color-line-soft)] disabled:text-muted";

/** Same as fieldInputClass but auto-sizing for textareas. */
export const fieldTextareaClass =
  "w-full bg-white border border-[var(--color-line)] rounded-xl px-3 py-2 " +
  "text-[14px] text-text placeholder:text-muted/80 outline-none " +
  "transition-all duration-150 ease-out " +
  "focus:border-gold focus:shadow-[var(--shadow-focus)]";
