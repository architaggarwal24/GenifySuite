"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSubmitting(false);

    if (!res || !res.ok) {
      setError(data?.error ?? "Couldn't reach the server. Try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="text-2xl font-semibold text-paper">Reset your password</h1>
      <p className="mt-2 text-sm text-paper-dim">Enter your email and we'll send you a link to choose a new one.</p>

      <Card className="mt-6">
        {sent ? (
          <div role="status" className="space-y-3 text-sm text-paper-dim">
            <p className="text-paper">Check your inbox.</p>
            <p>
              If an account exists for <span className="font-mono text-paper">{email}</span>, a reset link is on its way. It
              works once and expires in an hour.
            </p>
            <Link href="/login" className="inline-block text-brass hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-rust">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-center text-sm">
              <Link href="/login" className="text-paper-faint hover:text-paper-dim hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
