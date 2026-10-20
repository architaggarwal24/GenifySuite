import { HISTORY_LIMITS, jsonChars } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { RESOURCE_RATE_LIMITS, consumeRateLimit } from "@/lib/rate-limit";

export type HistoryWriteCheck = { ok: true } | { ok: false; status: number; error: string; retryAfterSeconds?: number };

/**
 * Is this user allowed to save this payload to their history? Checks, cheapest first: the payload exists and
 * is a sane size, the user isn't saving in a tight loop, and they haven't hit their stored-item cap.
 */
export async function checkHistoryWrite(userId: string, payload: unknown): Promise<HistoryWriteCheck> {
  const size = jsonChars(payload);
  if (size === null) return { ok: false, status: 400, error: "Nothing to save." };
  if (size > HISTORY_LIMITS.maxPayloadChars) {
    return { ok: false, status: 413, error: `That's too large to save (max ${HISTORY_LIMITS.maxPayloadChars.toLocaleString("en-US")} characters).` };
  }

  const limit = RESOURCE_RATE_LIMITS.historyWrite;
  const rate = await consumeRateLimit("history-write", userId, limit.limit, limit.windowSeconds);
  if (!rate.allowed) {
    return { ok: false, status: 429, error: "You're saving too fast. Try again in a moment.", retryAfterSeconds: rate.retryAfterSeconds };
  }

  const stored = await prisma.historyItem.count({ where: { userId } });
  if (stored >= HISTORY_LIMITS.maxItems) {
    return { ok: false, status: 409, error: `Your history is full (${HISTORY_LIMITS.maxItems.toLocaleString("en-US")} items). Delete some to save more.` };
  }
  return { ok: true };
}
