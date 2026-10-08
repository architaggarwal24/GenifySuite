import { type ReactNode } from "react";

/**
 * Wraps a tool's result block so it animates in on each generation instead
 * of just appearing. Pass a `revealKey` that changes every time new output
 * is produced (a counter, or the output itself) - React remounts the div
 * on key change, which restarts the CSS animation.
 */
export function ResultReveal({ revealKey, children }: { revealKey: string | number; children: ReactNode }) {
  return (
    <div key={revealKey} className="animate-fade-slide-up">
      {children}
    </div>
  );
}
