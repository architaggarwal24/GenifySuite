"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Confirming needs a deliberate click rather than happening on page load: many mail systems pre-fetch
 * every link in an email to scan it, which would silently use up a one-time token before the person
 * ever saw the message.
 */
export function VerifyEmailForm() {
  const token = useSearchParams().get("token") ?? "";
  const { update } = useSession();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function confirm() {
    setState("working");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));

    if (!res || !res.ok) {
      setState("error");
      setMessage(data?.error ?? "Couldn't reach the server. Try again.");
      return;
    }
    await update(); // refresh the session so the "verify your email" banner disappears
    setState("done");
  }

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-paper">Confirm your email</h1>
      <Card className="mt-6 space-y-4">
        {!token ? (
          <p className="text-sm text-paper-dim">This page needs the link from your confirmation email.</p>
        ) : state === "done" ? (
          <div role="status" className="space-y-3 text-sm text-paper-dim">
            <p className="text-paper">Your email is confirmed.</p>
            <Link href="/dashboard" className="inline-block text-brass hover:underline">
              Go to your dashboard
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-paper-dim">Confirm that this is your email address to finish setting up your account.</p>
            {state === "error" && (
              <p role="alert" className="text-sm text-rust">
                {message}{" "}
                <Link href="/settings/account" className="text-brass hover:underline">
                  Request a new link
                </Link>
              </p>
            )}
            <Button className="w-full" onClick={confirm} disabled={state === "working"}>
              {state === "working" ? "Confirming…" : "Confirm email"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
