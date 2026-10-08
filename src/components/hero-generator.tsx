"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { estimatePasswordStrength, generatePassword } from "@/lib/password";

export function HeroGenerator() {
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword(
      generatePassword({ length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true })
    );
  }, []);

  function regenerate() {
    setPassword(
      generatePassword({ length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true })
    );
  }

  const strength = estimatePasswordStrength(password);

  return (
    <div className="w-full rounded border border-ink-line bg-ink-raised p-5">
      <div className="flex items-center justify-between border-b border-ink-line pb-3">
        <span className="text-xs text-paper-faint">password-generator</span>
        <span className="text-xs text-sage">{password ? strength.label : ""}</span>
      </div>
      <p
        className="my-5 break-all font-mono text-lg text-paper"
        aria-live="polite"
        suppressHydrationWarning
      >
        {password || "generating…"}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={regenerate}
          className="focus-ring flex-1 rounded border border-brass px-3 py-2 text-sm font-medium text-brass transition-colors hover:bg-brass/10"
        >
          Generate another
        </button>
        <CopyButton value={password} />
      </div>
    </div>
  );
}
