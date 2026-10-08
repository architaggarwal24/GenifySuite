import { type SubscriptionTier } from "@prisma/client";
import { SHARED_KEY_DAILY_LIMIT } from "@/lib/ai/usage";
import { TOOLS } from "@/lib/tools-registry";

export interface PlanConfig {
  tier: SubscriptionTier;
  name: string;
  priceLabel: string;
  dailyRequests: number;
  stripePriceId?: string;
  features: string[];
}

export const PLANS: PlanConfig[] = [
  {
    tier: "FREE",
    name: "Free",
    priceLabel: "$0",
    dailyRequests: SHARED_KEY_DAILY_LIMIT.FREE,
    features: [
      `${SHARED_KEY_DAILY_LIMIT.FREE} AI requests/day on our shared key`,
      "Unlimited if you bring your own key",
      `All ${TOOLS.length} tools, history, and the agent`,
    ],
  },
  {
    tier: "STARTER",
    name: "Starter",
    priceLabel: "$5/mo",
    dailyRequests: SHARED_KEY_DAILY_LIMIT.STARTER,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    features: [`${SHARED_KEY_DAILY_LIMIT.STARTER} AI requests/day on our shared key`, "Everything in Free"],
  },
  {
    tier: "PRO",
    name: "Pro",
    priceLabel: "$15/mo",
    dailyRequests: SHARED_KEY_DAILY_LIMIT.PRO,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    features: [`${SHARED_KEY_DAILY_LIMIT.PRO} AI requests/day on our shared key`, "Everything in Starter"],
  },
];

export function getPlan(tier: SubscriptionTier): PlanConfig {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}
