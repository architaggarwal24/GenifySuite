"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { validatePassword } from "@/lib/password-policy";

interface Props {
  email: string;
  name: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  hasActiveSubscription: boolean;
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  return { ok: Boolean(res?.ok), data: (data ?? {}) as { error?: string } };
}

export function AccountSettingsClient({ email, name, emailVerified, hasPassword, hasActiveSubscription }: Props) {
  const router = useRouter();
  const { update } = useSession();

  // --- email verification
  const [resend, setResend] = useState<{ state: "idle" | "sending" | "sent"; error?: string }>({ state: "idle" });
  async function handleResend() {
    setResend({ state: "sending" });
    const { ok, data } = await call("/api/auth/resend-verification", "POST");
    setResend(ok ? { state: "sent" } : { state: "idle", error: data.error ?? "Couldn't send the email." });
  }

  // --- change password
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pw, setPw] = useState<{ busy: boolean; error?: string; done?: boolean }>({ busy: false });
  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (next !== confirm) return setPw({ busy: false, error: "The two new passwords don't match." });
    const policy = validatePassword(next, { email, name });
    if (policy) return setPw({ busy: false, error: policy });

    setPw({ busy: true });
    const { ok, data } = await call("/api/account/password", "POST", { currentPassword: current, newPassword: next });
    if (!ok) return setPw({ busy: false, error: data.error ?? "Couldn't change the password." });

    // The change signs out every session, this one included; sign straight back in with the new password.
    await signIn("credentials", { email, password: next, redirect: false });
    setCurrent("");
    setNext("");
    setConfirm("");
    setPw({ busy: false, done: true });
    router.refresh();
  }

  // --- sign out everywhere
  const [signingOut, setSigningOut] = useState(false);
  async function handleSignOutEverywhere() {
    setSigningOut(true);
    await call("/api/account/sessions", "DELETE");
    await signOut({ callbackUrl: "/login" });
  }

  // --- delete account
  const [confirmEmail, setConfirmEmail] = useState("");
  const [del, setDel] = useState<{ busy: boolean; error?: string }>({ busy: false });
  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    setDel({ busy: true });
    const { ok, data } = await call("/api/account", "DELETE", { confirmEmail });
    if (!ok) return setDel({ busy: false, error: data.error ?? "Couldn't delete the account." });
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-medium text-paper">Email</h2>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-paper-dim">
          <span className="font-mono text-paper">{email}</span>
          <span className={`rounded-sm border px-2 py-0.5 text-xs ${emailVerified ? "border-sage/40 text-sage" : "border-brass/40 text-brass"}`}>
            {emailVerified ? "Confirmed" : "Not confirmed"}
          </span>
        </p>
        {!emailVerified && (
          <div className="mt-3">
            <p className="text-sm text-paper-dim">Confirm your address to use the shared AI key and subscribe.</p>
            <Button className="mt-3" variant="secondary" size="sm" onClick={handleResend} disabled={resend.state !== "idle"}>
              {resend.state === "sending" ? "Sending…" : resend.state === "sent" ? "Email sent" : "Resend confirmation email"}
            </Button>
            {resend.error && <p className="mt-2 text-sm text-rust">{resend.error}</p>}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-paper">Password</h2>
        {hasPassword ? (
          <form onSubmit={handleChangePassword} className="mt-3 space-y-4">
            <div>
              <Label htmlFor="current">Current password</Label>
              <Input id="current" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="new">New password</Label>
                <Input id="new" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
            {pw.error && (
              <p role="alert" className="text-sm text-rust">
                {pw.error}
              </p>
            )}
            {pw.done && (
              <p role="status" className="text-sm text-sage">
                Password changed. Your other devices were signed out.
              </p>
            )}
            <Button type="submit" disabled={pw.busy}>
              {pw.busy ? "Saving…" : "Change password"}
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-paper-dim">
            You sign in with Google or GitHub, so there's no password to change. To also sign in with a password, use{" "}
            <Link href="/forgot-password" className="text-brass hover:underline">
              Forgot password
            </Link>{" "}
            to create one.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-paper">Sessions</h2>
        <p className="mt-2 text-sm text-paper-dim">Signed in somewhere you shouldn't be? This signs out every device, including this one.</p>
        <Button className="mt-3" variant="secondary" size="sm" onClick={handleSignOutEverywhere} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out everywhere"}
        </Button>
      </Card>

      <Card className="border-rust/40">
        <h2 className="text-lg font-medium text-rust">Delete account</h2>
        <p className="mt-2 text-sm text-paper-dim">
          Permanently deletes your account, saved history, workflows, API keys and usage. This can't be undone.
          {hasActiveSubscription && " Your subscription will be cancelled first."}
        </p>
        <form onSubmit={handleDelete} className="mt-3 space-y-3">
          <div>
            <Label htmlFor="confirm-email">
              Type <span className="font-mono text-paper">{email}</span> to confirm
            </Label>
            <Input id="confirm-email" autoComplete="off" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
          </div>
          {del.error && (
            <p role="alert" className="text-sm text-rust">
              {del.error}
            </p>
          )}
          <Button type="submit" variant="danger" disabled={del.busy || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}>
            {del.busy ? "Deleting…" : "Delete my account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
