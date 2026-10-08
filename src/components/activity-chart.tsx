interface DayCount {
  label: string;
  count: number;
}

/** A plain CSS bar chart - no charting library, matches the flat/hairline design system. */
export function ActivityChart({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-paper-faint">
        Nothing saved in the last {days.length} days yet - generate something and hit "Save to history".
      </p>
    );
  }

  return (
    <div className="flex h-28 items-end gap-1.5">
      {days.map((d, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1.5" title={`${d.label}: ${d.count}`}>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-sm bg-brass/70 transition-colors group-hover:bg-brass"
              style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-paper-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
