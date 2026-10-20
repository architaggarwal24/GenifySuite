import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** True when the limiter's store was unavailable and the request was let through (see below). */
  degraded?: boolean;
}

/** Scope whose windows are 30 days long, so housekeeping must not prune it after a day. */
const LONG_WINDOW_PREFIX = "login-known:";

interface WindowInfo {
  key: string;
  windowStart: Date;
  retryAfterSeconds: number;
}

function windowFor(scope: string, id: string, windowSeconds: number, now: number): WindowInfo {
  const windowMs = windowSeconds * 1000;
  const windowIndex = Math.floor(now / windowMs);
  return {
    key: `${scope}:${id}:${windowIndex}`,
    windowStart: new Date(windowIndex * windowMs),
    retryAfterSeconds: Math.max(1, Math.ceil(((windowIndex + 1) * windowMs - now) / 1000)),
  };
}

// If the limiter's own table is missing (a forgotten `db:push`) or the database hiccups, we let the
// request through rather than fail every login and AI call with an opaque 500. A rate limiter is a
// guard rail, not the thing the user came for. The failure is logged (at most once a minute).
let lastDegradedLog = 0;
function degraded(limit: number, windowInfo: WindowInfo, err: unknown, now: number): RateLimitResult {
  if (now - lastDegradedLog > 60_000) {
    lastDegradedLog = now;
    console.error("[rate-limit] store unavailable - allowing the request (is the RateLimit table created? run `npm run db:push`):", err);
  }
  return { allowed: true, remaining: limit, retryAfterSeconds: windowInfo.retryAfterSeconds, degraded: true };
}

/**
 * Database-backed fixed-window rate limiter: counts this request and says whether it is allowed.
 *
 * It's in the database rather than in memory because on serverless hosts (Vercel) every request may
 * land on a different instance, so an in-memory counter would let people multiply their limit by
 * however many instances happen to be warm. Each call is one atomic upsert-increment on a single
 * unique key, so concurrent requests can't race past the limit. Trade-off of a fixed window: a burst
 * straddling a window boundary can briefly reach ~2x the limit - fine for abuse prevention.
 */
export async function consumeRateLimit(
  scope: string,
  id: string,
  limit: number,
  windowSeconds: number,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const info = windowFor(scope, id, windowSeconds, now);

  try {
    const row = await prisma.rateLimit.upsert({
      where: { key: info.key },
      create: { key: info.key, count: 1, windowStart: info.windowStart },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    // Housekeeping: occasionally prune windows that can no longer matter. Long-window rows (the 30-day
    // "known device" markers) get their own, longer horizon - a flat 24h would delete them almost at once.
    if (Math.random() < 0.02) {
      const day = 24 * 60 * 60 * 1000;
      void prisma.rateLimit
        .deleteMany({ where: { windowStart: { lt: new Date(now - day) }, NOT: { key: { startsWith: LONG_WINDOW_PREFIX } } } })
        .catch(() => undefined);
      void prisma.rateLimit
        .deleteMany({ where: { windowStart: { lt: new Date(now - 35 * day) }, key: { startsWith: LONG_WINDOW_PREFIX } } })
        .catch(() => undefined);
    }

    return {
      allowed: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      retryAfterSeconds: info.retryAfterSeconds,
    };
  } catch (err) {
    return degraded(limit, info, err, now);
  }
}

/**
 * Read-only counterpart: is one MORE event still allowed in this window? Doesn't count anything.
 * Used for failure throttling (e.g. login), where only failed attempts should count: check with
 * peekRateLimit before the attempt, and consumeRateLimit only if it fails. That way a successful
 * login never burns the allowance, and an attacker can't lock a victim out with valid-looking traffic.
 */
export async function peekRateLimit(
  scope: string,
  id: string,
  limit: number,
  windowSeconds: number,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const info = windowFor(scope, id, windowSeconds, now);

  try {
    const row = await prisma.rateLimit.findUnique({ where: { key: info.key }, select: { count: true } });
    const count = row?.count ?? 0;
    return {
      allowed: count < limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: info.retryAfterSeconds,
    };
  } catch (err) {
    return degraded(limit, info, err, now);
  }
}

/**
 * Gives back one unit in the current window (never below zero). Pair it with consumeRateLimit for
 * "count first, forgive on success": counting BEFORE the work closes the gap where many parallel requests
 * all pass a read-only check, and refunding after a success keeps good behaviour free.
 */
export async function refundRateLimit(scope: string, id: string, windowSeconds: number, now: number = Date.now()): Promise<void> {
  const info = windowFor(scope, id, windowSeconds, now);
  try {
    await prisma.rateLimit.updateMany({ where: { key: info.key, count: { gt: 0 } }, data: { count: { decrement: 1 } } });
  } catch (err) {
    degraded(1, info, err, now); // only logs; a failed refund just means one extra counted event
  }
}

export interface RateLimitCheck {
  scope: string;
  /** null/empty skips the check (e.g. an unknown client IP) instead of pooling everyone into one bucket. */
  id: string | null;
  limit: number;
  windowSeconds: number;
}

/** Counts a request against every check; returns the first that is over its limit, or null if all pass. */
export async function consumeAll(checks: RateLimitCheck[]): Promise<RateLimitResult | null> {
  const results = await Promise.all(
    checks.filter((c) => c.id).map((c) => consumeRateLimit(c.scope, c.id as string, c.limit, c.windowSeconds))
  );
  return results.find((r) => !r.allowed) ?? null;
}

// Per-user, per-minute caps for AI endpoints. The shared key is stricter because it's your money.
export const AI_RATE_LIMITS = {
  shared: { limit: 6, windowSeconds: 60 },
  byok: { limit: 20, windowSeconds: 60 },
} as const;

const QUARTER_HOUR = 15 * 60;
const HOUR = 60 * 60;

// Limits for the account endpoints. The "failed" ones count only failures (see peekRateLimit).
export const AUTH_RATE_LIMITS = {
  // Failed sign-ins. Three views of the same attack: one person guessing at one account, one address
  // trying many accounts, and a distributed attack on a single account. Keying on email+IP together
  // means a stranger hammering your address can't lock YOU out from your own device.
  loginFailedPair: { limit: 8, windowSeconds: QUARTER_HOUR },
  loginFailedIp: { limit: 40, windowSeconds: QUARTER_HOUR },
  loginFailedEmail: { limit: 40, windowSeconds: QUARTER_HOUR },
  // A device that has signed into an account before. The per-account cap above doesn't apply to it, so a
  // stranger flooding failures at your email can't lock you out of the address you normally use.
  loginKnownDevice: { limit: 1, windowSeconds: 30 * 24 * HOUR },
  // Everything below counts every request, because each one costs us something (an email, a hash).
  registerIp: { limit: 10, windowSeconds: HOUR },
  forgotEmail: { limit: 3, windowSeconds: HOUR },
  forgotIp: { limit: 10, windowSeconds: HOUR },
  resetIp: { limit: 20, windowSeconds: HOUR },
  verifyIp: { limit: 30, windowSeconds: HOUR },
  resendVerification: { limit: 3, windowSeconds: HOUR },
  passwordChange: { limit: 5, windowSeconds: QUARTER_HOUR },
} as const;

// Per-user caps on routes that spend a shared resource or write to the database.
export const RESOURCE_RATE_LIMITS = {
  // ip-api.com's free tier allows ~45 requests/minute for the whole server, so the app-wide cap sits below that.
  ipLookupUser: { limit: 15, windowSeconds: 60 },
  ipLookupAll: { limit: 40, windowSeconds: 60 },
  historyWrite: { limit: 60, windowSeconds: 60 },
} as const;
