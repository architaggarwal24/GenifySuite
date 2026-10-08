"use client";

import { useEffect, useState } from "react";
import { AiAssistSection } from "@/components/ai-assist-section";
import { CopyButton } from "@/components/copy-button";
import { ResultReveal } from "@/components/result-reveal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiRun } from "@/hooks/use-ai-run";

const MODES = [
  { id: "explain", label: "Explain this" },
  { id: "typescript", label: "To TypeScript" },
  { id: "zod", label: "To Zod schema" },
] as const;

const MAX_CHARS = 8000;

export function JsonAiAssist({ json }: { json: string }) {
  const { run, loading, error } = useAiRun();
  const [output, setOutput] = useState<{ mode: string; text: string } | null>(null);

  // Formatting different JSON invalidates any previous AI output.
  useEffect(() => setOutput(null), [json]);

  const tooLong = json.length > MAX_CHARS;

  return (
    <AiAssistSection>
      {(selection) => (
        <div>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button
                key={m.id}
                variant="secondary"
                size="sm"
                disabled={!selection || loading || tooLong}
                onClick={async () => {
                  const result = await run<{ output: string }>("json-assist", { json, mode: m.id }, selection);
                  if (result) setOutput({ mode: m.id, text: result.output });
                }}
              >
                {m.label}
              </Button>
            ))}
          </div>

          {tooLong && (
            <p className="mt-2 text-xs text-paper-faint">
              This JSON is over the {MAX_CHARS.toLocaleString()}-character limit for AI assist.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-rust">
              {error}
            </p>
          )}

          {loading && (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {output && !loading && (
            <ResultReveal revealKey={output.text}>
              <div className="mt-4">
                {output.mode === "explain" ? (
                  <div className="whitespace-pre-line rounded border border-ink-line bg-ink p-4 text-sm leading-relaxed text-paper-dim">
                    {output.text}
                  </div>
                ) : (
                  <pre className="max-h-96 overflow-auto rounded border border-ink-line bg-ink p-4 font-mono text-xs text-paper">
                    {output.text}
                  </pre>
                )}
                <div className="mt-3">
                  <CopyButton value={output.text} />
                </div>
              </div>
            </ResultReveal>
          )}
        </div>
      )}
    </AiAssistSection>
  );
}
