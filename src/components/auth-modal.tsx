"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { SignInForm, SignUpForm } from "@/components/auth-forms";
import { OAuthButtons } from "@/components/oauth-buttons";
import { AUTH_MODAL_EVENT, type AuthModalDetail, type AuthModalMode } from "@/lib/auth-modal";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import { cn } from "@/lib/utils";

/**
 * Global login / sign-up popup. Mounted once in the root layout and opened from anywhere through
 * openAuthModal() (see lib/auth-modal.ts). Closes on Esc, backdrop click, or as soon as a session exists.
 */
export function AuthModal() {
  const router = useRouter();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("login");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");

  useEffect(() => {
    function handleOpen(event: Event) {
      const detail = ((event as CustomEvent<AuthModalDetail>).detail ?? {}) as AuthModalDetail;
      setMode(detail.mode ?? "login");
      setRedirectTo(detail.redirectTo ? safeCallbackUrl(detail.redirectTo, "") || null : null);
      // OAuth round-trips leave the page, so remember where to come back to.
      setCallbackUrl(safeCallbackUrl(window.location.pathname + window.location.search, "/dashboard"));
      setOpen(true);
    }
    window.addEventListener(AUTH_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(AUTH_MODAL_EVENT, handleOpen);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Esc to close + lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  // If a session shows up while the popup is open (e.g. signed in from another tab), get out of the way.
  useEffect(() => {
    if (open && status === "authenticated") setOpen(false);
  }, [open, status]);

  function handleSuccess() {
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    // Re-run server components so locked tool pages, the navbar and the pricing page see the new session.
    router.refresh();
  }

  if (!open) return null;

  const isLogin = mode === "login";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ink/70 px-4 py-10 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="glass relative w-full max-w-md animate-fade-slide-up rounded-2xl p-6 shadow-2xl shadow-black/40 sm:p-7"
      >
        <div aria-hidden className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-brass/30 via-transparent to-cyan-glow/20 blur-xl" />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="focus-ring absolute right-3 top-3 rounded-lg p-2 text-paper-faint transition-colors hover:bg-paper/5 hover:text-paper"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex gap-1 rounded-xl border border-ink-line bg-ink/50 p-1">
          {(
            [
              { id: "login", label: "Sign in" },
              { id: "register", label: "Create account" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={cn(
                "focus-ring flex-1 rounded-lg px-3 py-1.5 text-sm transition-all",
                mode === tab.id ? "bg-brass/15 text-paper shadow-glow-sm" : "text-paper-faint hover:text-paper-dim"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <h2 id="auth-modal-title" className="font-display text-2xl font-semibold tracking-tight text-paper">
          {isLogin ? "Welcome back" : "Create your free account"}
        </h2>
        <p className="mt-1.5 text-sm text-paper-dim">
          {isLogin
            ? "Sign in to use every tool and keep your history."
            : "Unlock every tool in a few seconds. No card needed."}
        </p>

        <div className="mt-5">
          <OAuthButtons callbackUrl={callbackUrl} />
          {isLogin ? (
            <SignInForm key="login" onSuccess={handleSuccess} onNavigate={close} />
          ) : (
            <SignUpForm key="register" onSuccess={handleSuccess} onSwitchToLogin={() => setMode("login")} />
          )}
        </div>
      </div>
    </div>
  );
}
