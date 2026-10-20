import { type SubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Daily requests allowed when using GenifySuite's own shared key, by tier.
// FREE (no active subscription) gets a small trial allowance so people can
// try the feature before paying. Tune these against your actual per-request
// cost once you know your token usage.
export const SHARED_KEY_DAILY_LIMIT: Record<SubscriptionTier, number> = {
  FREE: 3,
  STARTER: 50,
  PRO: 300,
};

// Flat daily cap applied even to BYOK requests. It's still your server and
// database doing the work regardless of whose key it is, so this exists to
// stop a compromised or scripted account from hammering the agent loop -
// not to meter cost. Generous on purpose.
export const BYOK_DAILY_LIMIT = 200;

type UsageSource = "shared" | "byok";

const sourceOf = (usingSharedKey: boolean): UsageSource => (usingSharedKey ? "shared" : "byok");

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function getTodayCount(userId: string, source: UsageSource): Promise<number> {
  const row = await prisma.aiUsage.findUnique({
    where: { userId_date_source: { userId, date: todayUtc(), source } },
  });
  return row?.count ?? 0;
}

export interface UsageCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * Checks (without incrementing) whether a request is allowed right now.
 * Read-only (used for display, e.g. the dashboard). To actually take a request
 * from the allowance, use reserveUsage(), which is atomic.
 */
export async function checkUsage(userId: string, usingSharedKey: boolean, tier: SubscriptionTier): Promise<UsageCheckResult> {
  const limit = usingSharedKey ? SHARED_KEY_DAILY_LIMIT[tier] : BYOK_DAILY_LIMIT;
  const used = await getTodayCount(userId, sourceOf(usingSharedKey));
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
}

/**
 * Atomically TAKES one request from today's allowance, before any provider work starts. Counting up front
 * (and refunding only failures that cost nothing - see isRefundableAiError) closes two holes in
 * check-then-record-on-success: parallel requests can't all slip past the check, and dropping the
 * connection mid-request can't dodge the count.
 */
export async function reserveUsage(userId: string, usingSharedKey: boolean, tier: SubscriptionTier): Promise<UsageCheckResult> {
  const limit = usingSharedKey ? SHARED_KEY_DAILY_LIMIT[tier] : BYOK_DAILY_LIMIT;
  const source = sourceOf(usingSharedKey);

  // Fast path: already exhausted, so don't touch the counter at all.
  if ((await getTodayCount(userId, source)) >= limit) return { allowed: false, remaining: 0, limit };

  const date = todayUtc();
  const row = await prisma.aiUsage.upsert({
    where: { userId_date_source: { userId, date, source } },
    create: { userId, date, source, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  if (row.count > limit) {
    await releaseUsage(userId, usingSharedKey); // we raced others for the last slots and lost; undo our increment
    return { allowed: false, remaining: 0, limit };
  }
  return { allowed: true, remaining: limit - row.count, limit };
}

/** Gives one reserved request back (never below zero). */
export async function releaseUsage(userId: string, usingSharedKey: boolean): Promise<void> {
  await prisma.aiUsage.updateMany({
    where: { userId, date: todayUtc(), source: sourceOf(usingSharedKey), count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
}

export async function recordUsage(userId: string, usingSharedKey: boolean): Promise<void> {
  const source = sourceOf(usingSharedKey);
  await prisma.aiUsage.upsert({
    where: { userId_date_source: { userId, date: todayUtc(), source } },
    create: { userId, date: todayUtc(), source, count: 1 },
    update: { count: { increment: 1 } },
  });
}
