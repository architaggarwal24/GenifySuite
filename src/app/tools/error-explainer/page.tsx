"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { AiKeyPicker, type KeySelection } from "@/components/ai-key-picker";
import { CopyButton } from "@/components/copy-button";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiRun } from "@/hooks/use-ai-run";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("error-explainer")!;

interface Diagnosis {
  summary: string;
  cause: string;
  steps: string[];
  searchQuery: string;
}

export default function ErrorExplainerPage() {
  const [selection, setSelection] = useState<KeySelection | null>(null);
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const { run, loading, error } = useAiRun();

  async function handleExplain() {
    const result = await run<Diagnosis>(
      "error-explainer",
      { text, context: context.trim() || undefined },
      selection
    );
    if (result) setDiagnosis(result);
  }

  const asText = diagnosis
    ? `${diagnosis.summary}\n\nCause: ${diagnosis.cause}\n\nFix:\n${diagnosis.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    : "";

  return (
    <ToolShell tool={tool}>
      <Card>
        <AiKeyPicker value={selection} onChange={setSelection} />

        <div className="mt-4">
          <Label htmlFor="error-text">Error message or stack trace</Label>
          <Textarea
            id="error-text"
            rows={9}
            spellCheck={false}
            className="font-mono"
            placeholder={"TypeError: Cannot read properties of undefined (reading 'map')\n    at ProductList (ProductList.tsx:14:22)"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <Label htmlFor="error-context">Context (optional)</Label>
          <Input
            id="error-context"
            placeholder="e.g. Next.js 15, React 18, fetching from a REST API"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        <Button className="mt-4" onClick={handleExplain} disabled={!selection || !text.trim() || loading}>
          {loading ? "Diagnosing…" : "Explain this error"}
        </Button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-5 space-y-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {diagnosis && !loading && (
          <ResultReveal revealKey={diagnosis.summary}>
            <div className="mt-5 space-y-4">
              <p className="font-display text-base font-medium text-paper">{diagnosis.summary}</p>

              <div>
                <p className="text-xs font-medium text-paper-faint">Likely cause</p>
                <p className="mt-1 text-sm text-paper-dim">{diagnosis.cause}</p>
              </div>

              {diagnosis.steps.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-paper-faint">What to try</p>
                  <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm text-paper-dim">
                    {diagnosis.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <CopyButton value={asText} />
                {diagnosis.searchQuery && (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(diagnosis.searchQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring inline-flex items-center gap-1.5 rounded border border-ink-line px-3 py-1.5 text-sm text-paper hover:border-paper-dim"
                  >
                    Search the web <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </a>
                )}
                <SaveHistoryButton tool="error-explainer" label={diagnosis.summary.slice(0, 80)} payload={diagnosis} />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        Whatever you paste is sent to your chosen AI provider. Strip secrets, tokens and personal data from stack
        traces before pasting.
      </p>
    </ToolShell>
  );
}
