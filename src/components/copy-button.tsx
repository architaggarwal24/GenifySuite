"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions) -
      // fail quietly rather than throwing in the user's face.
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCopy} className={cn(className)}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
