export const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in UTC - the same bucketing AiUsage uses, so dashboard numbers line up with usage caps. */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Midnight UTC at the start of d's day (a date-only ISO string parses as that day's UTC midnight). */
export function utcDayStart(d: Date): Date {
  return new Date(dayKey(d));
}

/**
 * The instant a `days`-day window (ending today, inclusive) begins: midnight UTC, `days - 1` days ago.
 * Query the database with `createdAt >= activitySince(...)` and feed the rows to buildActivityWindow.
 *
 * It's deliberately a calendar-day boundary, not "now minus days*24h". A rolling cutoff only lines up
 * with day buckets when "now" is exactly midnight, so at any other time the oldest day you fetch has
 * no bucket to land in and its rows silently vanish from the chart.
 */
export function activitySince(now: Date, days: number): Date {
  return new Date(utcDayStart(now).getTime() - (days - 1) * DAY_MS);
}

export interface ActivityDay {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

/** Buckets row timestamps into `days` consecutive UTC days ending today, oldest first, zero-filled. */
export function buildActivityWindow(now: Date, createdAts: Date[], days: number): ActivityDay[] {
  const today = utcDayStart(now).getTime();
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(new Date(today - i * DAY_MS)), 0);

  for (const createdAt of createdAts) {
    const key = dayKey(createdAt);
    const current = buckets.get(key);
    if (current !== undefined) buckets.set(key, current + 1);
  }

  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}
