"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Fade/slide-up on scroll. Content is visible during SSR and for anything
 * already on screen at mount, so there's no flash and nothing is lost if JS
 * fails; only below-the-fold blocks get hidden, then revealed as they enter.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"ssr" | "hidden" | "shown">("ssr");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already in view

    setState("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={state === "shown" && delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(state === "hidden" && "reveal-hidden", state === "shown" && "reveal-shown", className)}
    >
      {children}
    </div>
  );
}
