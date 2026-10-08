"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { validatePassword } from "@/lib/password-policy";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    const policyError = validatePassword(password);
    if (policyError) {
      setError(policyError);
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSubmitting(false);

    if (!res || !res.ok) {
      setError(data?.error ?? "Couldn't reach the server. Try again.");
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-5 py-16">
        <h1 className="text-2xl font-semibold text-paper">Reset link missing</h1>
        <p className="mt-2 text-sm text-paper-dim">
          This page needs the link from your reset email.{" "}
          <Link href="/forgot-password" className="text-brass hover:underline">
            Request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="text-2xl font-semibold text-paper">Choose a new password</h1>

      <Card className="mt-6">
        {done ? (
          <div role="status" className="space-y-3 text-sm text-paper-dim">
            <p className="text-paper">Your password has been changed.</p>
            <p>Every device that was signed in has been signed out.</p>
            <Link href="/login" className="inline-block text-brass hover:underline">
              Sign in with your new password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="mt-1 text-xs text-paper-faint">At least 8 characters, and not a common password.</p>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-rust">
                {error}{" "}
                {/invalid or has expired/.test(error) && (
                  <Link href="/forgot-password" className="text-brass hover:underline">
                    Request a new link
                  </Link>
                )}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving…" : "Change password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
