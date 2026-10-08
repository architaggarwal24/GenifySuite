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
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("commit-message")!;

export default function CommitMessagePage() {
  const [selection, setSelection] = useState<KeySelection | null>(null);
  const [changes, setChanges] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!selection || !changes.trim()) return;
    setLoading(true);
    setError(null);
    setMessage("");

    const res = await fetch("/api/ai/commit-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes, ...selection }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't generate that.");
      return;
    }
    setMessage(data.message);
  }

  return (
    <ToolShell tool={tool}>
      <Card>
        <AiKeyPicker value={selection} onChange={setSelection} />

        <div className="mt-4">
          <Label htmlFor="changes">Diff or description of changes</Label>
          <Textarea
            id="changes"
            rows={8}
            spellCheck={false}
            className="font-mono"
            placeholder={"Paste a git diff, or just describe what changed:\nfixed the off-by-one error in the pagination logic"}
            value={changes}
            onChange={(e) => setChanges(e.target.value)}
          />
        </div>

        <Button className="mt-3" onClick={handleGenerate} disabled={!selection || !changes.trim() || loading}>
          {loading ? "Writing…" : "Generate commit message"}
        </Button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-5 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        )}

        {message && !loading && (
          <ResultReveal revealKey={message}>
            <div className="mt-5">
              <pre className="whitespace-pre-wrap rounded border border-ink-line bg-ink p-4 font-mono text-sm text-paper">
                {message}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton value={message} />
                <SaveHistoryButton
                  tool="commit-message"
                  label={message.split("\n")[0].slice(0, 60)}
                  payload={{ message }}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>
    </ToolShell>
  );
}
