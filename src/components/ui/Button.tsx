import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-gold text-white border border-transparent font-bold hover:bg-gold-deep",
  secondary:
    "bg-white border border-[var(--color-line-strong)] text-gold-deep hover:bg-[var(--color-line-soft)]",
  ghost:
    "bg-transparent border border-transparent text-gold-deep hover:bg-[var(--color-line-soft)]",
  danger:
    "bg-white border border-[#e9b9c0] text-[#a04050] hover:bg-[var(--color-danger-soft)]",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-md gap-1",
  md: "h-10 px-4 text-[14px] rounded-lg gap-1.5",
  lg: "h-12 px-5 text-[15px] rounded-lg gap-2",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    loading,
    fullWidth,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center font-medium tabular-nums",
        "transition-all duration-150 ease-out outline-none",
        "active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:shadow-[var(--shadow-focus)]",
        VARIANT[variant],
        SIZE[size],
        fullWidth ? "w-full" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <Loader2
          size={size === "sm" ? 14 : 16}
          className="animate-spin"
          aria-hidden
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});

export default Button;
