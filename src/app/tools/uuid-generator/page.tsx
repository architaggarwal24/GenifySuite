"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { generateTimeOrderedId, generateUuidV4 } from "@/lib/uuid";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("uuid-generator")!;

type Mode = "v4" | "time-ordered";

export default function UuidGeneratorPage() {
  const [mode, setMode] = useState<Mode>("v4");
  const [quantity, setQuantity] = useState(5);
  const [ids, setIds] = useState<string[]>([]);

  function handleGenerate() {
    const generator = mode === "v4" ? generateUuidV4 : generateTimeOrderedId;
    setIds(Array.from({ length: quantity }, generator));
  }

  const allAsText = ids.join("\n");

  return (
    <ToolShell tool={tool}>
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mode">Format</Label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper"
            >
              <option value="v4">UUID v4 (random)</option>
              <option value="time-ordered">Time-ordered (sortable)</option>
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
              {[1, 5, 10, 50].map((n) => (
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

        {ids.length > 0 && (
          <ResultReveal revealKey={ids[0]}>
            <div className="mt-5">
              <div className="space-y-1.5">
                {ids.map((id) => (
                  <div
                    key={id}
                    className="rounded border border-ink-line bg-ink px-3 py-2 font-mono text-sm text-paper"
                  >
                    {id}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <CopyButton value={allAsText} />
                <SaveHistoryButton
                  tool="uuid-generator"
                  label={`${quantity}x ${mode === "v4" ? "UUID v4" : "time-ordered"}`}
                  payload={{ mode, ids }}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>
    </ToolShell>
  );
}
