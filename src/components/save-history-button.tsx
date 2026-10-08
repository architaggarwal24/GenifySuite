"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SaveHistoryButtonProps {
  tool: string;
  label: string;
  payload: unknown;
  disabled?: boolean;
}

type Status = "idle" | "saving" | "saved" | "error";

export function SaveHistoryButton({ tool, label, payload, disabled }: SaveHistoryButtonProps) {
  const { status: sessionStatus } = useSession();
  const [status, setStatus] = useState<Status>("idle");

  if (sessionStatus === "unauthenticated") {
    return (
      <Link
        href="/login"
        className="focus-ring text-sm text-paper-dim underline decoration-ink-line underline-offset-4 hover:text-paper"
      >
        Sign in to save this to your history
      </Link>
    );
  }

  async function handleSave() {
    setStatus("saving");
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, label, payload }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2200);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleSave}
      disabled={disabled || status === "saving" || sessionStatus === "loading"}
    >
      {status === "saving" && "Saving…"}
      {status === "saved" && "Saved to history"}
      {status === "error" && "Couldn't save — try again"}
      {status === "idle" && "Save to history"}
    </Button>
  );
}
