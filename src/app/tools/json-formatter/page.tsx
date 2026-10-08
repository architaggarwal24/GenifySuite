"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { JsonAiAssist } from "@/components/json-ai-assist";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { processJson, type JsonParseResult } from "@/lib/json-tool";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("json-formatter")!;

const SAMPLE = `{"name":"GenifySuite","version":2,"tools":["validator","password-generator"]}`;

export default function JsonFormatterPage() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<number | "tab">(2);
  const [result, setResult] = useState<JsonParseResult | null>(null);

  function run() {
    setResult(processJson(input, indent));
  }

  return (
    <ToolShell tool={tool}>
      <Card>
        <div className="flex items-center justify-between">
          <Label htmlFor="json-input" className="mb-0">
            Paste JSON
          </Label>
          <button
            type="button"
            className="text-xs text-paper-faint hover:text-paper-dim"
            onClick={() => setInput(SAMPLE)}
          >
            Use sample
          </button>
        </div>
        <Textarea
          id="json-input"
          rows={10}
          spellCheck={false}
          className="font-mono"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input.trim()}>
            Format
          </Button>
          <label className="flex items-center gap-2 text-sm text-paper-dim">
            Indent
            <select
              value={indent}
              onChange={(e) => setIndent(e.target.value === "tab" ? "tab" : Number(e.target.value))}
              className="focus-ring rounded border border-ink-line bg-ink px-2 py-1 text-sm text-paper"
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value="tab">Tab</option>
            </select>
          </label>
        </div>

        {result && !result.valid && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {result.error}
            {result.errorLine && ` (line ${result.errorLine}, column ${result.errorColumn})`}
          </p>
        )}

        {result?.valid && result.formatted && (
          <ResultReveal revealKey={result.formatted}>
            <div className="mt-5">
              <pre className="max-h-96 overflow-auto rounded border border-ink-line bg-ink p-4 font-mono text-sm text-paper">
                {result.formatted}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton value={result.formatted} />
                {result.minified && (
                  <CopyButton value={result.minified} className="text-paper-dim" />
                )}
                <SaveHistoryButton
                  tool="json-formatter"
                  label={`${result.formatted.length} chars formatted`}
                  payload={{ formatted: result.formatted }}
                />
              </div>
              <p className="mt-2 text-xs text-paper-faint">
                Second copy button copies the minified version.
              </p>
            </div>
          </ResultReveal>
        )}

        {result?.valid && result.formatted && <JsonAiAssist json={result.formatted} />}
      </Card>
    </ToolShell>
  );
}
