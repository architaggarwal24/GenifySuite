"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { openAuthModal } from "@/lib/auth-modal";
import { type PlanConfig } from "@/lib/billing";
import { cn } from "@/lib/utils";

export function PricingCard({
  plan,
  current,
  featured = false,
}: {
  plan: PlanConfig;
  current: boolean;
  featured?: boolean;
}) {
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    if (status !== "authenticated") {
      openAuthModal({ mode: "register" });
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

  const [price, period] = plan.priceLabel.split("/");

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-ink-raised/70 p-7 shadow-card backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1",
        featured ? "border-beam border-transparent shadow-glow" : "border-ink-line"
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brass to-brass-dim px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-glow-sm">
          Most popular
        </span>
      )}

      <p className="font-display text-lg font-medium text-paper">{plan.name}</p>
      <p className="mt-3 flex items-baseline gap-1">
        <span className={cn("font-display text-4xl font-semibold", featured ? "text-gradient" : "text-paper")}>
          {price}
        </span>
        {period && <span className="text-sm text-paper-faint">/{period}</span>}
      </p>

      <ul className="mt-6 flex-1 space-y-3 text-sm text-paper-dim">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" strokeWidth={2.25} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-xs text-rust">{error}</p>}

      <div className="mt-7">
        {plan.tier === "FREE" ? (
          <Button variant="secondary" className="w-full" disabled>
            {current ? "Current plan" : "Default plan"}
          </Button>
        ) : current ? (
          <Button variant="secondary" className="w-full" disabled>
            Current plan
          </Button>
        ) : (
          <Button
            variant={featured ? "primary" : "secondary"}
            className="w-full"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {loading ? "Redirecting…" : `Subscribe to ${plan.name}`}
          </Button>
        )}
      </div>
    </div>
  );
}
