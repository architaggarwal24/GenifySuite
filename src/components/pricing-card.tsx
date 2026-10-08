"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { type PlanConfig } from "@/lib/billing";

export function PricingCard({ plan, current }: { plan: PlanConfig; current: boolean }) {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=/pricing`);
      return;
    }

    setLoading(true);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: plan.tier }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't start checkout.");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="flex flex-col rounded border border-ink-line bg-ink-raised p-6">
      <p className="font-display text-lg font-medium text-paper">{plan.name}</p>
      <p className="mt-1 text-2xl font-semibold text-brass">{plan.priceLabel}</p>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-paper-dim">
        {plan.features.map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>

      {error && <p className="mt-3 text-xs text-rust">{error}</p>}

      <div className="mt-5">
        {plan.tier === "FREE" ? (
          <Button variant="secondary" className="w-full" disabled>
            {current ? "Current plan" : "Default plan"}
          </Button>
        ) : current ? (
          <Button variant="secondary" className="w-full" disabled>
            Current plan
          </Button>
        ) : (
          <Button className="w-full" onClick={handleSubscribe} disabled={loading}>
            {loading ? "Redirecting…" : `Subscribe to ${plan.name}`}
          </Button>
        )}
      </div>
    </div>
  );
}
