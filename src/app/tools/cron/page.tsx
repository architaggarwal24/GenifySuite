"use client";

import { useMemo, useState } from "react";
import { AiKeyPicker, type KeySelection } from "@/components/ai-key-picker";
import { CopyButton } from "@/components/copy-button";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiRun } from "@/hooks/use-ai-run";
import { nextRuns, parseCron } from "@/lib/cron";
import { getToolBySlug } from "@/lib/tools-registry";
import { cn } from "@/lib/utils";

const tool = getToolBySlug("cron")!;

type Mode = "toCron" | "explain";

interface CronResult {
  cron: string;
  explanation: string;
  notes: string;
}

const MODES: { id: Mode; label: string; placeholder: string }[] = [
  { id: "toCron", label: "English → cron", placeholder: "e.g. every weekday at 9am, or the first Monday of each month at midnight" },
  { id: "explain", label: "Cron → English", placeholder: "e.g. */15 9-17 * * 1-5" },
];

function formatRun(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CronPage() {
  const [selection, setSelection] = useState<KeySelection | null>(null);
  const [mode, setMode] = useState<Mode>("toCron");
  const [text, setText] = useState("");
  const [result, setResult] = useState<CronResult | null>(null);
  const { run, loading, error } = useAiRun();

  // The expression we verify locally: what the user typed (explain mode) or what the model returned.
  const expressionToCheck = mode === "explain" ? text.trim() : (result?.cron ?? "");
  const parsed = useMemo(() => (expressionToCheck ? parseCron(expressionToCheck) : null), [expressionToCheck]);
  const upcoming = useMemo(
    () => (parsed && parsed.ok ? nextRuns(parsed.cron, new Date(), 5) : []),
    [parsed]
  );

  async function handleRun() {
    const response = await run<CronResult>("cron", { mode, text }, selection);
    if (response) setResult(response);
  }

  const current = MODES.find((m) => m.id === mode)!;

  return (
    <ToolShell tool={tool}>
      <Card>
        <div className="mb-4 inline-flex rounded border border-ink-line p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setResult(null);
                setText("");
              }}
              className={cn(
                "focus-ring rounded-sm px-3 py-1.5 text-sm transition-colors",
                mode === m.id ? "bg-brass/15 text-brass" : "text-paper-dim hover:text-paper"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Label htmlFor="cron-input">{mode === "toCron" ? "Describe the schedule" : "Cron expression"}</Label>
        <Input
          id="cron-input"
          className={mode === "explain" ? "font-mono" : undefined}
          placeholder={current.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {mode === "explain" && text.trim() && parsed && !parsed.ok && (
          <p role="alert" className="mt-2 text-sm text-rust">
            {parsed.error}
          </p>
        )}

        <div className="mt-4">
          <AiKeyPicker value={selection} onChange={setSelection} />
        </div>

        <Button className="mt-3" onClick={handleRun} disabled={!selection || !text.trim() || loading}>
          {loading ? "Working…" : mode === "toCron" ? "Generate cron" : "Explain in English"}
        </Button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-5 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {result && !loading && (
          <ResultReveal revealKey={result.cron + result.explanation}>
            <div className="mt-5 space-y-3">
              <p className="rounded border border-ink-line bg-ink px-4 py-3 font-mono text-lg text-paper">{result.cron}</p>
              <p className="text-sm text-paper">{result.explanation}</p>
              {result.notes && <p className="text-xs text-paper-faint">{result.notes}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <CopyButton value={result.cron} />
                <SaveHistoryButton
                  tool="cron"
                  label={`${result.cron} · ${text.trim().slice(0, 40)}`}
                  payload={result}
                />
              </div>
            </div>
          </ResultReveal>
        )}

        {/* Deterministic verification: computed locally, never trusting the model's word for it. */}
        {parsed && (mode === "explain" || (result && !loading)) && (
          <div className="mt-5 rounded border border-ink-line p-4">
            {parsed.ok ? (
              <>
                <p className="text-xs font-medium text-sage">Valid expression · next 5 runs (your local time)</p>
                <ul className="mt-2 space-y-1 font-mono text-xs text-paper-dim">
                  {upcoming.map((d) => (
                    <li key={d.getTime()}>{formatRun(d)}</li>
                  ))}
                </ul>
              </>
            ) : mode === "toCron" ? (
              <p className="text-sm text-rust">
                The model's expression didn't validate ({parsed.error}). Try rephrasing the schedule.
              </p>
            ) : null}
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        Uses standard 5-field crontab syntax (no seconds, no Quartz extensions). The run times above are computed in
        your browser from the expression itself, so they're a real check on the model's answer, not more model output.
      </p>
    </ToolShell>
  );
}
