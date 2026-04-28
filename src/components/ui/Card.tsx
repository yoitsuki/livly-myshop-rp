import type { HTMLAttributes, ReactNode } from "react";

type Padding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  border?: boolean;
  shadow?: boolean;
  children: ReactNode;
}

const PADDING: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export default function Card({
  padding = "md",
  border = true,
  shadow = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "bg-white rounded-2xl",
        border ? "border border-[var(--color-line)]" : "",
        shadow ? "shadow-[var(--shadow-card)]" : "",
        PADDING[padding],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
