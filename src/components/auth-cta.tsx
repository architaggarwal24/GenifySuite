"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { openAuthModal, type AuthModalMode } from "@/lib/auth-modal";

/**
 * Call-to-action button for server-rendered pages: signed-out visitors get the login/signup popup,
 * signed-in people get a plain link (to the dashboard by default) instead of a pointless "sign up".
 */
export function AuthCta({
  mode = "register",
  children,
  authedLabel = "Go to dashboard",
  authedHref = "/dashboard",
  size = "lg",
  variant = "primary",
}: {
  mode?: AuthModalMode;
  children: ReactNode;
  authedLabel?: string;
  authedHref?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary";
}) {
  const { status } = useSession();

  if (status === "authenticated") {
    return (
      <Link href={authedHref}>
        <Button size={size} variant={variant}>
          {authedLabel}
        </Button>
      </Link>
    );
  }

  return (
    <Button size={size} variant={variant} onClick={() => openAuthModal({ mode })}>
      {children}
    </Button>
  );
}
