import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-line bg-ink-raised/70 p-6 shadow-card backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-4", className)} {...props} />;
}
