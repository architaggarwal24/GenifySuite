"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Card } from "@/components/ui/card";
import { getToolBySlug } from "@/lib/tools-registry";
import { estimatePasswordStrength, generatePassword, type PasswordOptions } from "@/lib/password";

const tool = getToolBySlug("password-generator")!;

const STRENGTH_COLOR: Record<string, string> = {
  Weak: "text-rust",
  Fair: "text-brass",
  Strong: "text-sage",
  "Very strong": "text-sage",
};

export default function PasswordGeneratorPage() {
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword(generatePassword(options));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function regenerate(nextOptions: PasswordOptions = options) {
    const noCharsetSelected =
      !nextOptions.uppercase && !nextOptions.lowercase && !nextOptions.numbers && !nextOptions.symbols;
    setPassword(noCharsetSelected ? "" : generatePassword(nextOptions));
  }

  function toggle(key: keyof Omit<PasswordOptions, "length">) {
    const next = { ...options, [key]: !options[key] };
    setOptions(next);
    regenerate(next);
  }

  function handleLength(length: number) {
    const next = { ...options, length };
    setOptions(next);
    regenerate(next);
  }

  const strength = estimatePasswordStrength(password);

  return (
    <ToolShell tool={tool}>
      <Card>
        <ResultReveal revealKey={password}>
          <div className="flex items-center justify-between gap-3 rounded border border-ink-line bg-ink px-4 py-4">
            <span className="break-all font-mono text-lg text-paper" suppressHydrationWarning>
              {password || "Select at least one character type"}
            </span>
          </div>
        </ResultReveal>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => regenerate()}
            className="focus-ring rounded border border-brass px-3 py-2 text-sm font-medium text-brass hover:bg-brass/10"
          >
            Generate another
          </button>
          <CopyButton value={password} />
          {password && (
            <span className={`text-sm ${STRENGTH_COLOR[strength.label]}`}>
              {strength.label} · ~{strength.bits} bits of entropy
            </span>
          )}
        </div>

        <div className="mt-6 space-y-5 border-t border-ink-line pt-5">
          <div>
            <div className="flex items-center justify-between text-sm text-paper-dim">
              <label htmlFor="length">Length</label>
              <span className="font-mono">{options.length}</span>
            </div>
            <input
              id="length"
              type="range"
              min={8}
              max={64}
              value={options.length}
              onChange={(e) => handleLength(Number(e.target.value))}
              className="mt-2 w-full accent-brass"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Uppercase (A-Z)" checked={options.uppercase} onChange={() => toggle("uppercase")} />
            <Toggle label="Lowercase (a-z)" checked={options.lowercase} onChange={() => toggle("lowercase")} />
            <Toggle label="Numbers (2-9)" checked={options.numbers} onChange={() => toggle("numbers")} />
            <Toggle label="Symbols (!@#…)" checked={options.symbols} onChange={() => toggle("symbols")} />
          </div>
        </div>

        {password && (
          <div className="mt-5">
            <SaveHistoryButton
              tool="password-generator"
              label={`${options.length}-char password`}
              payload={{ length: options.length, strength: strength.label }}
              disabled={!password}
            />
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        Generated with the browser's cryptographic random number generator. Only the length and
        strength label are saved to history — never the password itself.
      </p>
    </ToolShell>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-paper-dim">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-ink-line bg-ink accent-brass" />
      {label}
    </label>
  );
}
