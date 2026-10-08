"use client";

import { useState } from "react";
import { AiKeyPicker, type KeySelection } from "@/components/ai-key-picker";
import { CopyButton } from "@/components/copy-button";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiRun } from "@/hooks/use-ai-run";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("fixtures")!;

const SAMPLE = `interface Order {
  id: string;            // uuid
  customerEmail: string;
  status: "pending" | "paid" | "shipped" | "refunded";
  items: { sku: string; name: string; quantity: number; unitPriceCents: number }[];
  placedAt: string;      // ISO 8601
}`;

export default function FixturesPage() {
  const [selection, setSelection] = useState<KeySelection | null>(null);
  const [schema, setSchema] = useState("");
  const [count, setCount] = useState(5);
  const [records, setRecords] = useState<unknown[] | null>(null);
  const { run, loading, error } = useAiRun();

  async function handleGenerate() {
    const result = await run<{ records: unknown[] }>("fixtures", { schema, count }, selection);
    if (result) setRecords(result.records);
  }

  function handleDownload() {
    if (!records) return;
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fixtures.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const asJson = records ? JSON.stringify(records, null, 2) : "";

  return (
    <ToolShell tool={tool}>
      <Card>
        <AiKeyPicker value={selection} onChange={setSelection} />

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="schema" className="mb-0">
              Schema, type, or description
            </Label>
            <button
              type="button"
              className="text-xs text-paper-faint hover:text-paper-dim"
              onClick={() => setSchema(SAMPLE)}
            >
              Use sample
            </button>
          </div>
          <Textarea
            id="schema"
            rows={9}
            spellCheck={false}
            className="mt-1.5 font-mono"
            placeholder={"A JSON Schema, a TypeScript interface, or plain English like:\nblog posts with title, slug, author, tags and a publish date"}
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="count">Records</Label>
            <select
              id="count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="focus-ring rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper"
            >
              {[1, 5, 10, 25].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={handleGenerate} disabled={!selection || !schema.trim() || loading}>
            {loading ? "Generating…" : "Generate records"}
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-5 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {records && !loading && (
          <ResultReveal revealKey={asJson}>
            <div className="mt-5">
              <p className="mb-2 text-xs text-paper-faint">
                {records.length} record{records.length === 1 ? "" : "s"}
              </p>
              <pre className="max-h-[28rem] overflow-auto rounded border border-ink-line bg-ink p-4 font-mono text-xs text-paper">
                {asJson}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton value={asJson} />
                <Button variant="secondary" size="sm" onClick={handleDownload}>
                  Download .json
                </Button>
                <SaveHistoryButton
                  tool="fixtures"
                  label={`${records.length} records · ${schema.trim().split("\n")[0].slice(0, 40)}`}
                  payload={{ count: records.length, records }}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        Records are generated by the model to fit your shape, so spot-check them against your real validation before
        relying on them. Emails use example.com-style domains.
      </p>
    </ToolShell>
  );
}
