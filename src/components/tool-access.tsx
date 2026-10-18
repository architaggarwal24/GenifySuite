"use client";

import { LockKeyhole } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import { Button } from "@/components/ui/button";
import { openAuthModal } from "@/lib/auth-modal";

interface ToolAccess {
  /** True when the server saw a valid session for this request. */
  authed: boolean;
}

// Defaults to locked: anything rendered outside the provider fails closed.
const ToolAccessContext = createContext<ToolAccess>({ authed: false });

/** Fed by app/tools/layout.tsx with the server-verified session state. */
export function ToolAccessProvider({ authed, children }: { authed: boolean; children: ReactNode }) {
  return <ToolAccessContext.Provider value={{ authed }}>{children}</ToolAccessContext.Provider>;
}

export function useToolAccess(): ToolAccess {
  return useContext(ToolAccessContext);
}

/** Shown above the /tools list for signed-out visitors: browse freely, sign in to use. */
export function GuestToolsBanner() {
  const { authed } = useToolAccess();
  if (authed) return null;

  return (
    <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-brass/25 bg-gradient-to-r from-brass/10 to-cyan-glow/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brass/30 bg-brass/10 text-brass">
          <LockKeyhole className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-display text-base font-medium text-paper">You&apos;re in preview mode</p>
          <p className="mt-0.5 text-sm text-paper-dim">
            Browse and open any tool to see how it works. Sign in or create a free account to actually use them.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={() => openAuthModal({ mode: "login" })}>
          Sign in
        </Button>
        <Button onClick={() => openAuthModal({ mode: "register" })}>Create account</Button>
      </div>
    </div>
  );
}
