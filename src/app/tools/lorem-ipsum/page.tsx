"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { generateLorem, type LoremUnit } from "@/lib/lorem";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("lorem-ipsum")!;

export default function LoremIpsumPage() {
  const [unit, setUnit] = useState<LoremUnit>("paragraphs");
  const [count, setCount] = useState(3);
  const [classic, setClassic] = useState(true);
  const [output, setOutput] = useState("");
  const [revealKey, setRevealKey] = useState(0);

  function handleGenerate() {
    setOutput(generateLorem(unit, count, classic));
    setRevealKey((k) => k + 1);
  }

  return (
    <ToolShell tool={tool}>
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="unit">Generate by</Label>
            <select
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as LoremUnit)}
              className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper"
            >
              <option value="words">Words</option>
              <option value="sentences">Sentences</option>
              <option value="paragraphs">Paragraphs</option>
            </select>
          </div>
          <div>
            <Label htmlFor="count">Count</Label>
            <input
              id="count"
              type="number"
              min={1}
              max={unit === "words" ? 500 : unit === "sentences" ? 60 : 20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-paper-dim">
          <input
            type="checkbox"
            checked={classic}
            onChange={(e) => setClassic(e.target.checked)}
            className="h-4 w-4 rounded border-ink-line bg-ink accent-brass"
          />
          Start with "Lorem ipsum dolor sit amet..."
        </label>

        <Button className="mt-4" onClick={handleGenerate}>
          Generate
        </Button>

        {output && (
          <ResultReveal revealKey={revealKey}>
            <div className="mt-5">
              <div className="whitespace-pre-line rounded border border-ink-line bg-ink p-4 text-sm leading-relaxed text-paper-dim">
                {output}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton value={output} />
                <SaveHistoryButton
                  tool="lorem-ipsum"
                  label={`${count} ${unit}`}
                  payload={{ unit, count, classic, output }}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>
    </ToolShell>
  );
}
