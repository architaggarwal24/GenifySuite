"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ManageBillingButton({ hasSubscription }: { hasSubscription: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasSubscription) return null;

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't open billing portal.");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleClick} disabled={loading}>
        {loading ? "Opening…" : "Manage billing"}
      </Button>
      {error && <p className="mt-2 text-sm text-rust">{error}</p>}
    </div>
  );
}
