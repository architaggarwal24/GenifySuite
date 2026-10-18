"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { validatePassword } from "@/lib/password-policy";

/** Email + password sign-in fields, used inside the popup. Mirrors the full-page /login form. */
export function SignInForm({ onSuccess, onNavigate }: { onSuccess: () => void; onNavigate?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);

    if (result?.error) {
      setError(
        result.error === "RATE_LIMITED"
          ? "Too many failed attempts. Wait a few minutes before trying again, or reset your password."
          : "That email or password doesn't match an account."
      );
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="auth-password">Password</Label>
          <Link
            href="/forgot-password"
            onClick={onNavigate}
            className="mb-1.5 text-xs text-paper-faint hover:text-paper-dim hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="auth-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-rust">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

/** Account creation fields, used inside the popup. Signs the person in straight after registering. */
export function SignUpForm({ onSuccess, onSwitchToLogin }: { onSuccess: () => void; onSwitchToLogin: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const policyError = validatePassword(password, { email, name });
    if (policyError) {
      setError(policyError);
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));

    if (!res || !res.ok) {
      setError(data?.error ?? "Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);

    if (result?.error) {
      // Account exists but the automatic sign-in didn't take: send them to the sign-in tab.
      onSwitchToLogin();
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="auth-name">Name</Label>
        <Input id="auth-name" required autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="auth-signup-email">Email</Label>
        <Input
          id="auth-signup-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="auth-signup-password">Password</Label>
        <Input
          id="auth-signup-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-paper-faint">At least 8 characters, and not a common password.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rust">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
