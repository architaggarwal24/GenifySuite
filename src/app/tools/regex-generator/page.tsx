"use client";

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
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("regex-generator")!;

interface RegexResult {
  regex: string;
  flags: string;
  explanation: string;
  example_match: string;
}

export default function RegexGeneratorPage() {
  const [selection, setSelection] = useState<KeySelection | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<RegexResult | null>(null);
  const [testInput, setTestInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!selection || !description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/ai/regex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, ...selection }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't generate that.");
      return;
    }
    setResult(data.result);
    setTestInput(data.result.example_match ?? "");
  }

  let testMatches: boolean | null = null;
  if (result && testInput) {
    try {
      testMatches = new RegExp(result.regex, result.flags).test(testInput);
    } catch {
      testMatches = null;
    }
  }

  return (
    <ToolShell tool={tool}>
      <Card>
        <AiKeyPicker value={selection} onChange={setSelection} />

        <div className="mt-4">
          <Label htmlFor="description">Describe the pattern</Label>
          <Textarea
            id="description"
            rows={2}
            placeholder="e.g. a US phone number with optional dashes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <Button className="mt-3" onClick={handleGenerate} disabled={!selection || !description.trim() || loading}>
          {loading ? "Generating…" : "Generate regex"}
        </Button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-5 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {result && !loading && (
          <ResultReveal revealKey={result.regex}>
            <div className="mt-5 space-y-4">
              <div className="rounded border border-ink-line bg-ink p-3">
                <p className="break-all font-mono text-sm text-paper">
                  /{result.regex}/{result.flags}
                </p>
              </div>
              <p className="text-sm text-paper-dim">{result.explanation}</p>

              <div>
                <Label htmlFor="test-input">Test it</Label>
                <Input id="test-input" value={testInput} onChange={(e) => setTestInput(e.target.value)} />
                {testInput && (
                  <p className={`mt-1.5 text-sm ${testMatches ? "text-sage" : "text-rust"}`}>
                    {testMatches === null ? "Invalid pattern" : testMatches ? "Matches" : "Doesn't match"}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <CopyButton value={result.regex} />
                <SaveHistoryButton
                  tool="regex-generator"
                  label={description.slice(0, 50)}
                  payload={result}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>
    </ToolShell>
  );
}
