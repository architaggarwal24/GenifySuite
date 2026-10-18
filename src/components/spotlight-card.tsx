"use client";

import Link from "next/link";
import { type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Card whose border + background glow follows the cursor (reactbits
 * "SpotlightCard" idea). Renders a <Link> when `href` is given, else a <div>.
 * Position is written to CSS vars straight on the node - no re-renders.
 */
export function SpotlightCard({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  function handleMove(e: MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  const classes = cn(
    "spotlight focus-ring relative block overflow-hidden rounded-2xl border border-ink-line bg-ink-raised/60 p-5 shadow-card backdrop-blur-sm transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-transparent",
    className
  );

  if (href) {
    return (
      <Link href={href} onMouseMove={handleMove} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <div onMouseMove={handleMove} className={classes}>
      {children}
    </div>
  );
}
