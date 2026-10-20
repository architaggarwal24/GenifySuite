import type { SubscriptionTier } from "@prisma/client";

/**
 * Stripe subscription statuses that entitle someone to a paid plan. Everything else - past_due, unpaid,
 * incomplete, incomplete_expired, canceled, paused - means payment isn't in good standing right now.
 * (To offer a grace period for failed payments, add "past_due" here.)
 */
const ENTITLED_STATUSES = new Set(["active", "trialing"]);

export function isEntitledStatus(status: string | null | undefined): boolean {
  return status != null && ENTITLED_STATUSES.has(status);
}

/**
 * The plan someone should actually get. A paid tier only counts while the subscription is in good standing.
 * A row with NO Stripe status is a grant made by hand in the database, so its tier is trusted as-is.
 */
export function effectiveTier(subscription: { tier: SubscriptionTier; status?: string | null } | null | undefined): SubscriptionTier {
  if (!subscription) return "FREE";
  if (subscription.status == null) return subscription.tier;
  return isEntitledStatus(subscription.status) ? subscription.tier : "FREE";
}
