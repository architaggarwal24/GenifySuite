"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "genifysuite-verify-banner-dismissed";

/** Nudges signed-in people with an unconfirmed email to confirm it (needed for the shared key and billing). */
export function VerifyEmailBanner() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // storage unavailable: just keep showing it
    }
  }, []);

  if (status !== "authenticated" || session.user.emailVerified || dismissed || pathname.startsWith("/verify-email")) return null;

  async function resend() {
    setState("sending");
    setError(null);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res || !res.ok) {
      setState("error");
      setError(data?.error ?? "Couldn't reach the server.");
      return;
    }
    setState("sent");
  }

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div role="status" className="border-b border-brass/30 bg-brass-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 text-sm text-paper-dim">
        <span>
          {state === "sent"
            ? "Confirmation email sent - check your inbox."
            : "Confirm your email address to use the shared AI key and subscribe."}
        </span>
        {state !== "sent" && (
          <button type="button" onClick={resend} disabled={state === "sending"} className="font-medium text-brass hover:underline disabled:opacity-50">
            {state === "sending" ? "Sending…" : "Resend email"}
          </button>
        )}
        {error && <span className="text-rust">{error}</span>}
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="ml-auto text-paper-faint hover:text-paper-dim">
          Dismiss
        </button>
      </div>
    </div>
  );
}
