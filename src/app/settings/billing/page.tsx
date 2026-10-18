import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ManageBillingButton } from "@/components/manage-billing-button";
import { SettingsTabs } from "@/components/settings-tabs";
import { Card } from "@/components/ui/card";
import { getPlan } from "@/lib/billing";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings/billing");

  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  const plan = getPlan(subscription?.tier ?? "FREE");

  return (
    <div className="mx-auto max-w-xl px-5 py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-paper">Settings</h1>
      <SettingsTabs />
      <p className="mb-6 text-paper-dim">Your plan for using GenifySuite's shared AI key.</p>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-medium text-paper">{plan.name}</p>
            <p className="text-sm text-paper-faint">{plan.priceLabel}</p>
          </div>
          {subscription?.status && (
            <span className="rounded-sm border border-ink-line px-2 py-0.5 text-xs text-paper-faint">
              {subscription.status}
            </span>
          )}
        </div>

        <ul className="mt-4 space-y-1.5 text-sm text-paper-dim">
          {plan.features.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>

        <div className="mt-5 flex items-center gap-3">
          <ManageBillingButton hasSubscription={Boolean(subscription?.stripeCustomerId)} />
          <Link href="/pricing" className="text-sm text-brass hover:underline">
            {plan.tier === "FREE" ? "Upgrade" : "Change plan"}
          </Link>
        </div>
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        This only affects usage of GenifySuite's own shared key — bringing your own key in{" "}
        <Link href="/settings/ai" className="hover:underline">
          AI settings
        </Link>{" "}
        is always free.
      </p>
    </div>
  );
}
