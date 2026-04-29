import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "ghost" | "subtle" | "danger";
type Size = "sm" | "md" | "lg";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** aria-label is required for accessibility — no visible text. */
  "aria-label": string;
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  ghost:
    "text-text/70 hover:text-text hover:bg-[var(--color-line-soft)]",
  subtle:
    "text-text bg-[var(--color-line-soft)] hover:bg-[var(--color-line)]",
  danger:
    "text-[#a04050] hover:bg-[var(--color-danger-soft)]",
};

const SIZE: Record<Size, string> = {
  sm: "w-7 h-7 rounded",
  md: "w-9 h-9 rounded-md",
  lg: "w-10 h-10 rounded-md",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      variant = "ghost",
      size = "md",
      type = "button",
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center transition-colors duration-150 ease-out outline-none",
          "focus-visible:shadow-[var(--shadow-focus)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          VARIANT[variant],
          SIZE[size],
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export default IconButton;
