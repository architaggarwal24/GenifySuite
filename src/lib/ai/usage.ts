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
 * Call this before doing any provider work, then call recordUsage() only
 * after the request actually succeeds. (Check-then-record isn't atomic, so
 * a burst of parallel requests can overshoot the cap slightly; the per-minute
 * rate limiter bounds how far.)
 */
export async function checkUsage(userId: string, usingSharedKey: boolean, tier: SubscriptionTier): Promise<UsageCheckResult> {
  const limit = usingSharedKey ? SHARED_KEY_DAILY_LIMIT[tier] : BYOK_DAILY_LIMIT;
  const used = await getTodayCount(userId, sourceOf(usingSharedKey));
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
}

export async function recordUsage(userId: string, usingSharedKey: boolean): Promise<void> {
  const source = sourceOf(usingSharedKey);
  await prisma.aiUsage.upsert({
    where: { userId_date_source: { userId, date: todayUtc(), source } },
    create: { userId, date: todayUtc(), source, count: 1 },
    update: { count: { increment: 1 } },
  });
}
