import { getServerSession } from "next-auth";
import { Eyebrow } from "@/components/section-heading";
import { PricingCard } from "@/components/pricing-card";
import { authOptions } from "@/lib/auth";
import { PLANS } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { effectiveTier } from "@/lib/billing-status";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const subscription = session?.user?.id
    ? await prisma.subscription.findUnique({ where: { userId: session.user.id } })
    : null;
  const currentTier = effectiveTier(subscription);

  return (
    <div className="mx-auto max-w-5xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          Simple, <span className="text-gradient-animated">honest</span> pricing
        </h1>
        <p className="mt-4 text-paper-dim">
          Only matters if you use GenifySuite&apos;s shared AI key. Bringing your own key (Anthropic,
          OpenAI, a local Ollama, NVIDIA NIM, or any OpenAI-compatible endpoint) is free on every
          plan.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.tier}
            plan={plan}
            current={plan.tier === currentTier}
            featured={plan.tier === "STARTER"}
          />
        ))}
      </div>
    </div>
  );
}
