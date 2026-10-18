"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { estimatePasswordStrength, generatePassword } from "@/lib/password";

const STRENGTH_STYLE: Record<string, { width: string; color: string }> = {
  Weak: { width: "25%", color: "bg-rust" },
  Fair: { width: "50%", color: "bg-brass" },
  Strong: { width: "78%", color: "bg-sage" },
  "Very strong": { width: "100%", color: "bg-sage" },
};

function make() {
  return generatePassword({ length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true });
}

export function HeroGenerator() {
  const [password, setPassword] = useState("");
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    setPassword(make());
  }, []);

  function regenerate() {
    setPassword(make());
    setSpin((n) => n + 1);
  }

  const strength = estimatePasswordStrength(password);
  const bar = STRENGTH_STYLE[strength.label] ?? STRENGTH_STYLE.Weak;

  return (
    <div className="relative w-full animate-float">
      {/* soft glow behind the card */}
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-brass/20 blur-3xl" />

      <div className="border-beam glass relative rounded-2xl p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-ink-line/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rust/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-brass/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-sage/70" />
            <span className="ml-2 font-mono text-xs text-paper-faint">password-generator</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-sage">
            {password && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-sage" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
                </span>
                {strength.label}
              </>
            )}
          </span>
        </div>

        <p
          className="my-6 min-h-[3.5rem] break-all font-mono text-xl leading-snug text-paper"
          aria-live="polite"
          suppressHydrationWarning
        >
          {password || "generating…"}
        </p>

        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-ink-line/70">
          <div
            className={`h-full rounded-full transition-all duration-500 ${bar.color}`}
            style={{ width: password ? bar.width : "0%" }}
          />
        </div>

        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={regenerate}
            className="focus-ring group flex flex-1 items-center justify-center gap-2 rounded-lg border border-brass/40 bg-brass/10 px-3 py-2.5 text-sm font-medium text-brass transition-all hover:border-brass hover:bg-brass/20"
          >
            <RefreshCw
              key={spin}
              className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180"
              strokeWidth={2}
            />
            Generate another
          </button>
          <CopyButton value={password} />
        </div>
      </div>
    </div>
  );
}
