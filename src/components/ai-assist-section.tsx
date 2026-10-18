"use client";

import { Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { AiKeyPicker, type KeySelection } from "@/components/ai-key-picker";
import { openAuthModal } from "@/lib/auth-modal";

/**
 * A consistent "AI assist" block for tools that are deterministic by default
 * but can optionally be enhanced with a model. Handles the signed-out state
 * and key selection so each tool only supplies its own controls.
 */
export function AiAssistSection({
  title = "AI assist",
  children,
}: {
  title?: string;
  children: (selection: KeySelection | null) => ReactNode;
}) {
  const { status } = useSession();
  const [selection, setSelection] = useState<KeySelection | null>(null);

  return (
    <div className="mt-6 border-t border-ink-line pt-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brass" strokeWidth={1.75} />
        <h2 className="text-sm font-medium text-paper">{title}</h2>
      </div>

      {status === "unauthenticated" && (
        <p className="text-sm text-paper-dim">
          <button type="button" onClick={() => openAuthModal({ mode: "login" })} className="text-brass hover:underline">
            Sign in
          </button>{" "}
          to use AI assist with your own key.
        </p>
      )}

      {status === "authenticated" && (
        <>
          <AiKeyPicker value={selection} onChange={setSelection} />
          <div className="mt-4">{children(selection)}</div>
        </>
      )}
    </div>
  );
}
