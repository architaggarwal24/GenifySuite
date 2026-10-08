import { describe, expect, it } from "vitest";
import { DAY_MS, activitySince, buildActivityWindow, dayKey, utcDayStart } from "./activity";

const DAYS = 14;
const addDays = (key: string, n: number) => dayKey(new Date(new Date(key).getTime() + n * DAY_MS));

describe("activity window (dashboard chart)", () => {
  // The invariants that make the chart trustworthy, checked at awkward times of day, across a month
  // boundary, a leap day, and a year boundary - not just on a convenient timestamp.
  const NOWS = [
    "2026-09-29T03:00:00Z",
    "2026-09-29T00:00:00.000Z", // exactly midnight
    "2026-09-29T23:59:59.999Z", // last instant of the day
    "2026-03-01T12:00:00Z", // month boundary
    "2028-03-01T12:00:00Z", // leap day inside the window
    "2027-01-03T06:00:00Z", // year boundary
  ];

  it.each(NOWS)("has 14 consecutive UTC days ending today, with the query cutoff on the oldest day's midnight (now=%s)", (iso) => {
    const now = new Date(iso);
    const window = buildActivityWindow(now, [], DAYS);
    const keys = window.map((d) => d.date);

    expect(keys).toHaveLength(DAYS);
    expect(new Set(keys).size).toBe(DAYS);
    keys.forEach((key, i) => i > 0 && expect(key).toBe(addDays(keys[i - 1], 1)));
    expect(keys[DAYS - 1]).toBe(dayKey(now));
    expect(keys[0]).toBe(addDays(dayKey(now), -(DAYS - 1)));
    // The bug this guards against: a cutoff that doesn't land exactly on the oldest bucket's midnight
    // fetches rows that no bucket can hold, so they silently disappear.
    expect(activitySince(now, DAYS).getTime()).toBe(utcDayStart(new Date(keys[0])).getTime());
  });

  it("counts every row the query would return - none are dropped, even on the boundary day", () => {
    const now = new Date("2026-09-29T03:00:00Z");
    const since = activitySince(now, DAYS);
    const rows = [
      new Date("2026-09-29T02:59:00Z"), // today
      new Date("2026-09-28T23:59:00Z"), // yesterday
      new Date(since.getTime()), // exactly the cutoff: oldest day, first instant
      new Date(since.getTime() + 5 * 3600 * 1000), // oldest day, mid-morning
    ];
    const window = buildActivityWindow(now, rows, DAYS);
    expect(window.reduce((sum, d) => sum + d.count, 0)).toBe(rows.length);
    expect(window[0].count).toBe(2);
    expect(window[DAYS - 1].count).toBe(1);
  });

  it("ignores rows older than the window or in the future", () => {
    const now = new Date("2026-09-29T03:00:00Z");
    const since = activitySince(now, DAYS);
    const rows = [new Date(since.getTime() - 1), new Date("2026-09-30T00:00:00Z"), new Date("2020-01-01T00:00:00Z")];
    expect(buildActivityWindow(now, rows, DAYS).every((d) => d.count === 0)).toBe(true);
  });

  it("aggregates several rows on the same day and zero-fills quiet days", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const rows = Array.from({ length: 5 }, (_, i) => new Date(Date.UTC(2026, 8, 27, i, 0, 0)));
    const window = buildActivityWindow(now, rows, 7);
    expect(window).toHaveLength(7);
    expect(window.find((d) => d.date === "2026-09-27")?.count).toBe(5);
    expect(window.filter((d) => d.count === 0)).toHaveLength(6);
  });

  it("supports other window sizes", () => {
    expect(buildActivityWindow(new Date("2026-09-29T00:00:00Z"), [], 7)).toHaveLength(7);
    expect(buildActivityWindow(new Date("2026-09-29T00:00:00Z"), [], 1)).toEqual([{ date: "2026-09-29", count: 0 }]);
  });
});
