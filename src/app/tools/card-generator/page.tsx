"use client";

import { useState } from "react";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { ALL_NETWORKS, generateTestCard, type CardNetwork, type GeneratedTestCard } from "@/lib/cards";
import { CopyButton } from "@/components/copy-button";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("card-generator")!;

export default function CardGeneratorPage() {
  const [network, setNetwork] = useState<CardNetwork>("Visa");
  const [quantity, setQuantity] = useState(5);
  const [cards, setCards] = useState<GeneratedTestCard[]>([]);
  const [revealKey, setRevealKey] = useState(0);

  function handleGenerate() {
    const next: GeneratedTestCard[] = [];
    for (let i = 0; i < quantity; i++) next.push(generateTestCard(network));
    setCards(next);
    setRevealKey((k) => k + 1);
  }

  const allAsText = cards
    .map((c) => `${c.number} | ${c.expMonth}/${c.expYear} | CVV ${c.cvv} | ${c.network}`)
    .join("\n");

  return (
    <ToolShell tool={tool}>
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="network">Network</Label>
            <select
              id="network"
              value={network}
              onChange={(e) => setNetwork(e.target.value as CardNetwork)}
              className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper"
            >
              {ALL_NETWORKS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <select
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper"
            >
              {[1, 5, 10, 25].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button className="mt-4" onClick={handleGenerate}>
          Generate
        </Button>

        {cards.length > 0 && (
          <ResultReveal revealKey={revealKey}>
            <div className="mt-5 space-y-2">
              {cards.map((c, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 rounded border border-ink-line bg-ink px-3 py-2 font-mono text-sm text-paper sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{c.number}</span>
                  <span className="text-paper-faint">
                    {c.expMonth}/{c.expYear} · CVV {c.cvv} · {c.network}
                  </span>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <CopyButton value={allAsText} />
                <SaveHistoryButton
                  tool="card-generator"
                  label={`${quantity}x ${network} test cards`}
                  payload={{ network, quantity, cards }}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        These numbers pass the Luhn checksum but are randomly generated from generic
        network prefixes — the same kind of pattern card networks publish for their own
        sandbox/test-mode docs. They are not tied to real accounts and cannot be charged.
        For testing an arbitrary bank's BIN range, use your payment provider's official
        test-mode numbers instead.
      </p>
    </ToolShell>
  );
}
