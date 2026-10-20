import { type SubscriptionTier } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AiRequestDenied, isRefundableAiError } from "@/lib/ai/errors";
import { releaseUsage, reserveUsage } from "@/lib/ai/usage";
import { effectiveTier } from "@/lib/billing-status";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { AI_RATE_LIMITS, consumeRateLimit } from "@/lib/rate-limit";
import { type AiProviderId, type ProviderCredentials } from "@/lib/ai/types";

// The provider/model GenifySuite itself pays for when someone chooses
// "I don't have a key, use yours." Kept to a single cheap model by default
// to keep the operator's cost predictable — override via env if desired.
export const SHARED_PROVIDER: AiProviderId = "anthropic";
export const SHARED_MODEL = process.env.GENIFY_SHARED_MODEL || "claude-haiku-4-5";

export { AiRequestDenied };

export interface ResolvedAiRequest {
  userId: string;
  providerId: AiProviderId;
  model: string;
  credentials: ProviderCredentials;
  usingSharedKey: boolean;
}

interface ResolveInput {
  apiKeyId?: string;
  useShared?: boolean;
}

/**
 * Authenticates the request, works out which provider/credentials to use
 * (a saved BYOK key, or GenifySuite's shared key), and enforces the daily
 * usage cap for that path. Throws AiRequestDenied on any failure so routes
 * can just catch it and turn it into an HTTP response.
 */
export async function resolveAiRequest(input: ResolveInput): Promise<ResolvedAiRequest> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AiRequestDenied("Sign in to use AI tools.", 401);
  const userId = session.user.id;

  // Per-minute burst limit, checked first so a flood is rejected before we touch keys or usage counters.
  const bucket = input.useShared ? AI_RATE_LIMITS.shared : AI_RATE_LIMITS.byok;
  const rate = await consumeRateLimit(input.useShared ? "ai-shared" : "ai-byok", userId, bucket.limit, bucket.windowSeconds);
  if (!rate.allowed) {
    throw new AiRequestDenied(
      `You're going a bit fast. Please wait ${rate.retryAfterSeconds}s and try again.`,
      429,
      rate.retryAfterSeconds
    );
  }

  let providerId: AiProviderId;
  let model: string;
  let credentials: ProviderCredentials;
  let usingSharedKey = false;

  if (input.useShared) {
    // The shared key is your money and the free trial is per account, so unverified (possibly
    // throwaway) addresses can't spend it. Bringing your own key needs no verification.
    if (!session.user.emailVerified) {
      throw new AiRequestDenied(
        "Verify your email address to use GenifySuite's shared key. Check your inbox, or resend the link from Settings → Account.",
        403
      );
    }
    const sharedKey = process.env.ANTHROPIC_API_KEY;
    if (!sharedKey) {
      throw new AiRequestDenied(
        "This deployment hasn't configured a shared key yet. Add your own key in Settings instead.",
        503
      );
    }
    providerId = SHARED_PROVIDER;
    model = SHARED_MODEL;
    credentials = { apiKey: sharedKey };
    usingSharedKey = true;
  } else {
    if (!input.apiKeyId) throw new AiRequestDenied("No API key selected.", 400);

    const row = await prisma.apiKey.findUnique({ where: { id: input.apiKeyId } });
    if (!row || row.userId !== userId) throw new AiRequestDenied("That API key wasn't found.", 404);

    providerId = row.provider.toLowerCase() as AiProviderId;
    model = row.defaultModel;
    credentials = {
      apiKey: row.secret ? decryptSecret(row.secret) : undefined,
      baseUrl: row.baseUrl ?? undefined,
    };
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const tier: SubscriptionTier = effectiveTier(subscription);

  // Takes the request from the daily allowance NOW (atomically), before any provider work.
  const usage = await reserveUsage(userId, usingSharedKey, tier);
  if (!usage.allowed) {
    throw new AiRequestDenied(
      usingSharedKey
        ? `Daily limit reached for the shared key (${usage.limit}/day on your plan). Upgrade, or add your own key in Settings.`
        : `Daily limit reached (${usage.limit}/day). Try again tomorrow.`,
      429
    );
  }

  return { userId, providerId, model, credentials, usingSharedKey };
}

/**
 * Gives back the allowance taken by resolveAiRequest. Call it only for a failure that cost nothing
 * (see isRefundableAiError); everything else stays counted.
 */
export async function refundAiRequest(resolved: Pick<ResolvedAiRequest, "userId" | "usingSharedKey">): Promise<void> {
  await releaseUsage(resolved.userId, resolved.usingSharedKey);
}

/** In a route's catch block: give the allowance back if (and only if) the failure cost nothing. */
export async function refundIfFree(resolved: Pick<ResolvedAiRequest, "userId" | "usingSharedKey"> | undefined, err: unknown): Promise<void> {
  if (resolved && isRefundableAiError(err)) await refundAiRequest(resolved).catch(() => undefined);
}
