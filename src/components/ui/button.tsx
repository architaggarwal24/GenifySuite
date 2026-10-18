import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  // Gradient fill with a light sweep on hover (smoothui / kokonut "shimmer button")
  primary:
    "group/btn relative overflow-hidden border border-white/10 bg-gradient-to-b from-brass to-brass-dim text-white shadow-glow-sm hover:shadow-glow hover:brightness-110 active:scale-[0.98] before:absolute before:inset-y-0 before:-left-full before:w-1/2 before:skew-x-[-20deg] before:bg-white/25 before:opacity-0 before:transition-all before:duration-700 hover:before:left-[130%] hover:before:opacity-100",
  secondary:
    "border border-ink-line bg-ink-raised/60 text-paper backdrop-blur hover:border-brass/50 hover:bg-brass/10 active:scale-[0.98]",
  ghost: "border border-transparent bg-transparent text-paper-dim hover:bg-paper/5 hover:text-paper",
  danger: "border border-rust/40 bg-rust/5 text-rust hover:bg-rust/15 active:scale-[0.98]",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-6 py-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
