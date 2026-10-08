"use client";

import { useMemo, useState } from "react";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { detectNetwork, isLuhnValid } from "@/lib/cards";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("validator")!;

export default function ValidatorPage() {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [revealKey, setRevealKey] = useState(0);

  const digits = value.replace(/\D/g, "");
  const valid = useMemo(() => (digits ? isLuhnValid(digits) : false), [digits]);
  const network = useMemo(() => (digits ? detectNetwork(digits) : "Unknown"), [digits]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecked(true);
    setRevealKey((k) => k + 1);
  }

  return (
    <ToolShell tool={tool}>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="card-number">Card number</Label>
            <Input
              id="card-number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setChecked(false);
              }}
            />
          </div>
          <Button type="submit" disabled={digits.length < 8}>
            Check number
          </Button>
        </form>

        {checked && digits.length >= 8 && (
          <ResultReveal revealKey={revealKey}>
            <div
              className={`mt-5 rounded border p-4 ${
                valid ? "border-sage/40 bg-sage-soft" : "border-rust/40 bg-rust-soft"
              }`}
            >
              <p className={`font-medium ${valid ? "text-sage" : "text-rust"}`}>
                {valid ? "Passes the Luhn check" : "Fails the Luhn check"}
              </p>
              <p className="mt-1 text-sm text-paper-dim">Detected network: {network}</p>

              <div className="mt-4">
                <SaveHistoryButton
                  tool="validator"
                  label={`${network} · ${valid ? "valid" : "invalid"} · ···${digits.slice(-4)}`}
                  payload={{ last4: digits.slice(-4), network, valid }}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        The Luhn check catches typos and malformed numbers — it does not confirm a card is real,
        active, or authorized. Numbers you enter here are validated in your browser and are never
        sent anywhere; only the last 4 digits are saved if you choose to save to history.
      </p>
    </ToolShell>
  );
}
