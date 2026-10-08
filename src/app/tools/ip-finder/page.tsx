"use client";

import { useState, type FormEvent } from "react";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("ip-finder")!;

interface LookupResult {
  query: string;
  country?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
}

export default function IpFinderPage() {
  const [ip, setIp] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch(`/api/ip-lookup${ip ? `?ip=${encodeURIComponent(ip)}` : ""}`);
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Lookup failed.");
      return;
    }
    setResult(data.result);
  }

  return (
    <ToolShell tool={tool}>
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="ip">IP address</Label>
            <Input
              id="ip"
              placeholder="Leave blank to look up your own IP"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Looking up…" : "Look up"}
          </Button>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5 border-b border-ink-line pb-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        )}

        {result && !loading && (
          <ResultReveal revealKey={result.query}>
            <div className="mt-5">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="IP" value={result.query} />
                <Field label="City" value={result.city} />
                <Field label="Region" value={result.regionName} />
                <Field label="Country" value={result.country} />
                <Field label="Postal code" value={result.zip} />
                <Field label="Timezone" value={result.timezone} />
                <Field label="ISP" value={result.isp} />
                <Field label="Organization" value={result.org} />
                <Field label="Coordinates" value={result.lat && result.lon ? `${result.lat}, ${result.lon}` : undefined} />
              </dl>

              <div className="mt-5">
                <SaveHistoryButton tool="ip-finder" label={result.query} payload={result} />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        Location data is approximate and based on the IP's registered network block — it
        identifies an ISP or region, not a precise address or device.
      </p>
    </ToolShell>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="border-b border-ink-line pb-2">
      <dt className="text-xs text-paper-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm text-paper">{value}</dd>
    </div>
  );
}
