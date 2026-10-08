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

const tool = getToolBySlug("api-mock")!;

interface MockResponse {
  method: string;
  path: string;
  status: number;
  body: unknown;
}

const EXAMPLES = [
  "GET /users/:id returns a user with their 3 most recent orders",
  "POST /login fails with 401 and a helpful error body",
  "GET /products?page=2 returns a paginated list of 6 products",
];

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-sage";
  if (status >= 400) return "text-rust";
  return "text-brass";
}

export default function ApiMockPage() {
  const [selection, setSelection] = useState<KeySelection | null>(null);
  const [description, setDescription] = useState("");
  const [mock, setMock] = useState<MockResponse | null>(null);
  const { run, loading, error } = useAiRun();

  async function handleGenerate() {
    const result = await run<MockResponse>("api-mock", { description }, selection);
    if (result) setMock(result);
  }

  const bodyJson = mock ? JSON.stringify(mock.body, null, 2) : "";

  return (
    <ToolShell tool={tool}>
      <Card>
        <AiKeyPicker value={selection} onChange={setSelection} />

        <div className="mt-4">
          <Label htmlFor="endpoint">Describe the endpoint</Label>
          <Textarea
            id="endpoint"
            rows={3}
            placeholder="e.g. GET /invoices returns a paginated list of invoices with line items"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setDescription(example)}
                className="focus-ring rounded-sm border border-ink-line px-2 py-1 text-left text-xs text-paper-dim hover:border-brass/50 hover:text-paper"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <Button className="mt-4" onClick={handleGenerate} disabled={!selection || !description.trim() || loading}>
          {loading ? "Generating…" : "Generate mock response"}
        </Button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-5 space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {mock && !loading && (
          <ResultReveal revealKey={bodyJson}>
            <div className="mt-5">
              <p className="mb-2 font-mono text-sm">
                <span className="text-paper">{mock.method}</span> <span className="text-paper-dim">{mock.path}</span>{" "}
                <span className={statusColor(mock.status)}>→ {mock.status}</span>
              </p>
              <pre className="max-h-[28rem] overflow-auto rounded border border-ink-line bg-ink p-4 font-mono text-xs text-paper">
                {bodyJson}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton value={bodyJson} />
                <SaveHistoryButton
                  tool="api-mock"
                  label={`${mock.method} ${mock.path} → ${mock.status}`}
                  payload={mock}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>
    </ToolShell>
  );
}
