import { type ReactNode } from "react";

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-ink-line bg-ink-raised/70 p-5 shadow-card backdrop-blur-sm transition-colors hover:border-brass/40">
      <div
        aria-hidden
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brass/15 blur-2xl transition-opacity group-hover:bg-brass/25"
      />
      <p className="relative text-xs font-medium uppercase tracking-wide text-paper-faint">{label}</p>
      <p className="text-gradient relative mt-2 font-display text-3xl font-semibold">{value}</p>
      {sub && <p className="relative mt-1 text-xs text-paper-faint">{sub}</p>}
    </div>
  );
}
