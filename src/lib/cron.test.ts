import { describe, expect, it } from "vitest";
import { nextRuns, parseCron } from "./cron";

// Monday 2026-09-28 10:07:30 UTC (derived by hand: 2026-01-01 is a Thursday; Sept 28 is day 271 -> Monday)
const FROM = new Date(Date.UTC(2026, 8, 28, 10, 7, 30));

function runs(expr: string, count = 4, from = FROM): string[] {
  const parsed = parseCron(expr);
  if (!parsed.ok) throw new Error(parsed.error);
  return nextRuns(parsed.cron, from, count, true).map((d) => d.toISOString().slice(0, 16));
}

describe("cron: next runs", () => {
  it("steps every 15 minutes", () => {
    expect(runs("*/15 * * * *")).toEqual(["2026-09-28T10:15", "2026-09-28T10:30", "2026-09-28T10:45", "2026-09-28T11:00"]);
  });

  it("runs weekdays only, skipping the weekend", () => {
    expect(runs("0 9 * * 1-5", 5)).toEqual([
      "2026-09-29T09:00",
      "2026-09-30T09:00",
      "2026-10-01T09:00",
      "2026-10-02T09:00",
      "2026-10-05T09:00", // Friday -> next Monday
    ]);
  });

  it("rolls across months and years", () => {
    expect(runs("30 2 1 * *")).toEqual(["2026-10-01T02:30", "2026-11-01T02:30", "2026-12-01T02:30", "2027-01-01T02:30"]);
  });

  it("finds Feb 29 only in leap years", () => {
    expect(runs("0 0 29 2 *", 2)).toEqual(["2028-02-29T00:00", "2032-02-29T00:00"]);
  });

  it("accepts day names in a list", () => {
    expect(runs("0 12 * * MON,FRI")).toEqual(["2026-09-28T12:00", "2026-10-02T12:00", "2026-10-05T12:00", "2026-10-09T12:00"]);
  });

  it("supports start/step ('5/20' = 5, 25, 45)", () => {
    expect(runs("5/20 * * * *", 5)).toEqual([
      "2026-09-28T10:25",
      "2026-09-28T10:45",
      "2026-09-28T11:05",
      "2026-09-28T11:25",
      "2026-09-28T11:45",
    ]);
  });

  it("supports a range with a step", () => {
    expect(runs("10-30/10 * * * *")).toEqual(["2026-09-28T10:10", "2026-09-28T10:20", "2026-09-28T10:30", "2026-09-28T11:10"]);
  });

  it("uses OR when both day-of-month and day-of-week are restricted (Vixie cron semantics)", () => {
    // "the 13th, OR any Friday"
    expect(runs("0 0 13 * 5")).toEqual(["2026-10-02T00:00", "2026-10-09T00:00", "2026-10-13T00:00", "2026-10-16T00:00"]);
  });

  it("treats 0 and 7 as Sunday", () => {
    expect(runs("0 0 * * 7", 3)).toEqual(runs("0 0 * * 0", 3));
    expect(runs("0 0 * * 0", 2)).toEqual(["2026-10-04T00:00", "2026-10-11T00:00"]);
  });

  it("is case-insensitive for month and day names", () => {
    expect(runs("0 0 1 jan,JUL *", 3)).toEqual(["2027-01-01T00:00", "2027-07-01T00:00", "2028-01-01T00:00"]);
    expect(runs("0 9 * * mon-fri", 5)).toEqual(runs("0 9 * * 1-5", 5));
  });

  it("expands the @ shortcuts", () => {
    expect(runs("@hourly", 3)).toEqual(["2026-09-28T11:00", "2026-09-28T12:00", "2026-09-28T13:00"]);
    expect(runs("@daily", 2)).toEqual(["2026-09-29T00:00", "2026-09-30T00:00"]);
    expect(runs("@weekly", 2)).toEqual(["2026-10-04T00:00", "2026-10-11T00:00"]);
    expect(runs("@monthly", 2)).toEqual(["2026-10-01T00:00", "2026-11-01T00:00"]);
  });

  it("only returns times strictly after 'from'", () => {
    expect(runs("*/15 * * * *", 1, new Date(Date.UTC(2026, 8, 28, 10, 15, 0)))).toEqual(["2026-09-28T10:30"]);
    expect(runs("*/15 * * * *", 1, new Date(Date.UTC(2026, 8, 28, 10, 14, 59)))).toEqual(["2026-09-28T10:15"]);
  });

  it("tolerates extra whitespace", () => {
    expect(runs("  0   9  *  *  1-5 ", 1)).toEqual(["2026-09-29T09:00"]);
  });

  it("returns nothing (and terminates quickly) for a date that never exists", () => {
    const parsed = parseCron("0 0 31 4 *"); // April 31st
    if (!parsed.ok) throw new Error(parsed.error);
    const started = Date.now();
    expect(nextRuns(parsed.cron, FROM, 3, true)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("cron: validation", () => {
  const cases: [string, RegExp][] = [
    ["61 * * * *", /minute/],
    ["60 * * * *", /minute/],
    ["* * * *", /5 fields/],
    ["* * * * * *", /5 fields/],
    ["0 9 * * 8", /day-of-week/],
    ["0 9 5-1 * *", /backwards/],
    ["@bogus", /Unknown shortcut/],
    ["*/0 * * * *", /step/i],
    ["*/5/2 * * * *", /step/i],
    ["0 0 32 * *", /day-of-month/],
    ["0 0 0 * *", /day-of-month/],
    ["abc * * * *", /Unrecognised/],
    ["1,,2 * * * *", /Empty value/],
    ["1-2-3 * * * *", /Invalid range/],
    ["0 24 * * *", /hour/],
    ["0 0 1 13 *", /month/],
  ];

  it.each(cases)("rejects %s", (expression, message) => {
    const parsed = parseCron(expression);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(message);
  });

  it("accepts the '?' placeholder in the day fields", () => {
    expect(parseCron("0 9 ? * 1").ok).toBe(true);
  });
});
