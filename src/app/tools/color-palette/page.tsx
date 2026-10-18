"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { PaletteAiAssist } from "@/components/palette-ai-assist";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { generatePalette, randomBaseColor, type HarmonyType, type PaletteSwatch } from "@/lib/color";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("color-palette")!;

const HARMONIES: { value: HarmonyType; label: string }[] = [
  { value: "complementary", label: "Complementary" },
  { value: "analogous", label: "Analogous" },
  { value: "triadic", label: "Triadic" },
  { value: "split-complementary", label: "Split complementary" },
  { value: "monochrome", label: "Monochrome" },
];

export default function ColorPalettePage() {
  const [base, setBase] = useState("#e8a33d");
  const [harmony, setHarmony] = useState<HarmonyType>("analogous");
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);
  const [vibeName, setVibeName] = useState<string | null>(null);

  function handleGenerate() {
    setVibeName(null);
    setPalette(generatePalette(base, harmony));
  }

  function handleRandomBase() {
    const next = randomBaseColor();
    setBase(next);
    setVibeName(null);
    setPalette(generatePalette(next, harmony));
  }

  function handleVibe(vibe: { name: string; base: string; harmony: HarmonyType }) {
    setBase(vibe.base);
    setHarmony(vibe.harmony);
    setVibeName(vibe.name);
    setPalette(generatePalette(vibe.base, vibe.harmony));
  }

  const asText = palette.map((s) => s.hex).join(", ");

  return (
    <ToolShell tool={tool}>
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="base">Base color</Label>
            <div className="flex gap-2">
              <input
                id="base"
                type="color"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="h-10 w-14 rounded border border-ink-line bg-ink"
              />
              <input
                type="text"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 font-mono text-sm text-paper"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="harmony">Harmony</Label>
            <select
              id="harmony"
              value={harmony}
              onChange={(e) => setHarmony(e.target.value as HarmonyType)}
              className="focus-ring w-full rounded border border-ink-line bg-ink px-3 py-2 text-sm text-paper"
            >
              {HARMONIES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            className="focus-ring rounded-lg border border-white/10 bg-gradient-to-b from-brass to-brass-dim px-4 py-2.5 text-sm font-medium text-white shadow-glow-sm transition-all hover:shadow-glow hover:brightness-110 active:scale-[0.98]"
          >
            Generate palette
          </button>
          <button
            type="button"
            onClick={handleRandomBase}
            className="focus-ring rounded-lg border border-ink-line bg-ink-raised/60 px-4 py-2.5 text-sm text-paper transition-colors hover:border-brass/50 hover:bg-brass/10"
          >
            Random base
          </button>
        </div>

        {palette.length > 0 && (
          <ResultReveal revealKey={asText}>
            <div className="mt-5">
              {vibeName && <p className="mb-3 font-display text-base text-paper">{vibeName}</p>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {palette.map((swatch, i) => (
                  <div key={i} className="overflow-hidden rounded border border-ink-line">
                    <div className="h-20" style={{ backgroundColor: swatch.hex }} />
                    <div className="bg-ink px-2.5 py-2 font-mono text-xs text-paper-dim">{swatch.hex}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <CopyButton value={asText} />
                <SaveHistoryButton tool="color-palette" label={`${harmony} from ${base}`} payload={{ base, harmony, palette }} />
              </div>
            </div>
          </ResultReveal>
        )}

        <PaletteAiAssist onVibe={handleVibe} />
      </Card>
    </ToolShell>
  );
}
