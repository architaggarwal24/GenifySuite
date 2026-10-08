"use client";

import { useCallback, useState } from "react";
import { type KeySelection } from "@/components/ai-key-picker";

/** Client helper for the unified /api/ai/run endpoint: tracks loading + error state per caller. */
export function useAiRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(feature: string, input: unknown, selection: KeySelection | null): Promise<T | null> => {
      if (!selection) {
        setError("Pick a key first.");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feature, input, ...selection }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
          return null;
        }
        return data.result as T;
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { run, loading, error };
}
