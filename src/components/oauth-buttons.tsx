"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";
const GITHUB_ENABLED = process.env.NEXT_PUBLIC_GITHUB_OAUTH_ENABLED === "true";

export function OAuthButtons({ callbackUrl }: { callbackUrl: string }) {
  if (!GOOGLE_ENABLED && !GITHUB_ENABLED) return null;

  return (
    <div className="space-y-2">
      {GOOGLE_ENABLED && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl })}
        >
          Continue with Google
        </Button>
      )}
      {GITHUB_ENABLED && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("github", { callbackUrl })}
        >
          Continue with GitHub
        </Button>
      )}
      <div className="flex items-center gap-3 py-1 text-xs text-paper-faint">
        <span className="h-px flex-1 bg-ink-line" />
        or
        <span className="h-px flex-1 bg-ink-line" />
      </div>
    </div>
  );
}
