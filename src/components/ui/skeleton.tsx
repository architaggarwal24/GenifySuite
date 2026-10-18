import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,rgb(var(--color-ink-line)/0.5)_25%,rgb(var(--color-ink-line)/0.9)_50%,rgb(var(--color-ink-line)/0.5)_75%)] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}
