import { getServerSession } from "next-auth";
import { PricingCard } from "@/components/pricing-card";
import { authOptions } from "@/lib/auth";
import { PLANS } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const subscription = session?.user?.id
    ? await prisma.subscription.findUnique({ where: { userId: session.user.id } })
    : null;
  const currentTier = subscription?.tier ?? "FREE";

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <h1 className="text-2xl font-semibold text-paper">Pricing</h1>
      <p className="mt-2 max-w-lg text-paper-dim">
        Only matters if you use GenifySuite's shared AI key. Bringing your own key (Anthropic,
        OpenAI, a local Ollama, NVIDIA NIM, or any OpenAI-compatible endpoint) is free on every
        plan.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard key={plan.tier} plan={plan} current={plan.tier === currentTier} />
        ))}
      </div>
    </div>
  );
}
