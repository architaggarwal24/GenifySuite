import { type ReactNode } from "react";

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded border border-ink-line bg-ink-raised p-4">
      <p className="text-xs text-paper-faint">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-paper">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-paper-faint">{sub}</p>}
    </div>
  );
}
