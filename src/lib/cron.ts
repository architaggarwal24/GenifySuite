// A small, dependency-free cron engine for standard 5-field expressions
// (minute hour day-of-month month day-of-week, Vixie/Linux semantics).
// It exists so AI-generated cron expressions can be *verified* rather than
// trusted: we parse them and compute real upcoming run times.

export interface ParsedCron {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
}

export type CronParseResult = { ok: true; cron: ParsedCron } | { ok: false; error: string };

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DOW_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const ALIASES: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

function toNumber(token: string, names: string[] | undefined, nameOffset: number): number {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  if (names) {
    const idx = names.indexOf(token.toUpperCase());
    if (idx !== -1) return idx + nameOffset;
  }
  return NaN;
}

function parseField(
  field: string,
  label: string,
  min: number,
  max: number,
  names?: string[],
  nameOffset = 0
): Set<number> | string {
  const out = new Set<number>();

  for (const part of field.split(",")) {
    if (part === "") return `Empty value in the ${label} field.`;

    const [rangePart, stepPart, extra] = part.split("/");
    if (extra !== undefined) return `Invalid step in the ${label} field: "${part}".`;

    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || parseInt(stepPart, 10) < 1) {
        return `Invalid step "${stepPart}" in the ${label} field.`;
      }
      step = parseInt(stepPart, 10);
    }

    let start: number;
    let end: number;

    if (rangePart === "*" || rangePart === "?") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [a, b, more] = rangePart.split("-");
      if (more !== undefined) return `Invalid range "${rangePart}" in the ${label} field.`;
      start = toNumber(a, names, nameOffset);
      end = toNumber(b, names, nameOffset);
    } else {
      start = toNumber(rangePart, names, nameOffset);
      // "5/15" means "starting at 5, every 15"; a bare value is just that value.
      end = stepPart !== undefined ? max : start;
    }

    if (Number.isNaN(start) || Number.isNaN(end)) return `Unrecognised value "${rangePart}" in the ${label} field.`;
    if (start < min || end > max) return `${label} values must be between ${min} and ${max} (got "${rangePart}").`;
    if (start > end) return `Range "${rangePart}" in the ${label} field runs backwards.`;

    for (let v = start; v <= end; v += step) out.add(v);
  }

  return out;
}

export function parseCron(expression: string): CronParseResult {
  let expr = expression.trim().replace(/\s+/g, " ");
  if (expr.startsWith("@")) {
    const aliased = ALIASES[expr.toLowerCase()];
    if (!aliased) return { ok: false, error: `Unknown shortcut "${expr}".` };
    expr = aliased;
  }

  const fields = expr.split(" ");
  if (fields.length !== 5) {
    return {
      ok: false,
      error: `Expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}.`,
    };
  }

  const [minF, hourF, domF, monF, dowF] = fields;

  const minutes = parseField(minF, "minute", 0, 59);
  if (typeof minutes === "string") return { ok: false, error: minutes };
  const hours = parseField(hourF, "hour", 0, 23);
  if (typeof hours === "string") return { ok: false, error: hours };
  const daysOfMonth = parseField(domF, "day-of-month", 1, 31);
  if (typeof daysOfMonth === "string") return { ok: false, error: daysOfMonth };
  const months = parseField(monF, "month", 1, 12, MONTH_NAMES, 1);
  if (typeof months === "string") return { ok: false, error: months };
  const dowRaw = parseField(dowF, "day-of-week", 0, 7, DOW_NAMES, 0);
  if (typeof dowRaw === "string") return { ok: false, error: dowRaw };

  // Both 0 and 7 mean Sunday.
  const daysOfWeek = new Set<number>([...dowRaw].map((d) => (d === 7 ? 0 : d)));

  return {
    ok: true,
    cron: {
      minutes,
      hours,
      daysOfMonth,
      months,
      daysOfWeek,
      // Vixie cron: a field starting with "*" counts as unrestricted when
      // deciding between AND and OR for day-of-month / day-of-week.
      domRestricted: !domF.startsWith("*") && domF !== "?",
      dowRestricted: !dowF.startsWith("*") && dowF !== "?",
    },
  };
}

/**
 * Returns the next `count` times (after `from`) the expression fires.
 * Skips ahead by month/day/hour where possible so sparse schedules
 * (e.g. Feb 29) resolve quickly.
 */
export function nextRuns(cron: ParsedCron, from: Date, count: number, utc = false): Date[] {
  const results: Date[] = [];

  const make = (y: number, mo: number, d: number, h: number, mi: number) =>
    utc ? new Date(Date.UTC(y, mo, d, h, mi)) : new Date(y, mo, d, h, mi);

  let cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor = new Date(cursor.getTime() + 60_000);

  for (let i = 0; i < 250_000 && results.length < count; i++) {
    const y = utc ? cursor.getUTCFullYear() : cursor.getFullYear();
    const mo = utc ? cursor.getUTCMonth() : cursor.getMonth();
    const d = utc ? cursor.getUTCDate() : cursor.getDate();
    const h = utc ? cursor.getUTCHours() : cursor.getHours();
    const mi = utc ? cursor.getUTCMinutes() : cursor.getMinutes();
    const dow = utc ? cursor.getUTCDay() : cursor.getDay();

    if (!cron.months.has(mo + 1)) {
      cursor = make(y, mo + 1, 1, 0, 0);
      continue;
    }

    const domOk = cron.daysOfMonth.has(d);
    const dowOk = cron.daysOfWeek.has(dow);
    const dayOk =
      cron.domRestricted && cron.dowRestricted ? domOk || dowOk : cron.domRestricted ? domOk : cron.dowRestricted ? dowOk : true;

    if (!dayOk) {
      cursor = make(y, mo, d + 1, 0, 0);
      continue;
    }
    if (!cron.hours.has(h)) {
      cursor = make(y, mo, d, h + 1, 0);
      continue;
    }
    if (!cron.minutes.has(mi)) {
      cursor = new Date(cursor.getTime() + 60_000);
      continue;
    }

    results.push(new Date(cursor.getTime()));
    cursor = new Date(cursor.getTime() + 60_000);
  }

  return results;
}
