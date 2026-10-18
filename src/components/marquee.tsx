import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Infinite horizontal ticker (pure CSS). Children are rendered twice for a seamless loop. */
export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mask-fade-x group flex overflow-hidden", className)}>
      <div className="flex shrink-0 animate-marquee items-center gap-3 pr-3 group-hover:[animation-play-state:paused]">
        {children}
      </div>
      <div
        aria-hidden
        className="flex shrink-0 animate-marquee items-center gap-3 pr-3 group-hover:[animation-play-state:paused]"
      >
        {children}
      </div>
    </div>
  );
}
