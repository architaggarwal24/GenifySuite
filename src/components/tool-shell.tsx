"use client";

import { type ReactNode, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { IconTile } from "@/components/tool-icon";
import { useToolAccess } from "@/components/tool-access";
import { Button } from "@/components/ui/button";
import { openAuthModal } from "@/lib/auth-modal";
import { type ToolMeta, TOOLS } from "@/lib/tools-registry";
import { cn } from "@/lib/utils";

/**
 * Wraps every tool page. Signed-in: renders the tool as normal. Signed-out: renders a non-interactive,
 * blurred preview of the tool with an "unlock" card on top, and pops the login/signup dialog.
 *
 * The preview is made inert (no focus, no clicks, hidden from assistive tech) so it genuinely can't be
 * used. The real enforcement for anything that touches the server (AI tools, IP lookup, history) is in the
 * API routes themselves, which reject requests without a session.
 */
export function ToolShell({ tool, children }: { tool: ToolMeta; children: ReactNode }) {
  const { authed } = useToolAccess();
  const previewRef = useRef<HTMLDivElement>(null);

  // `inert` also blocks keyboard focus and screen readers, which pointer-events alone would not.
  useEffect(() => {
    if (previewRef.current) (previewRef.current as HTMLElement & { inert: boolean }).inert = !authed;
  }, [authed]);

  // Pop the dialog once per visit to a locked tool; closing it leaves the unlock card in place.
  useEffect(() => {
    if (authed) return;
    const timer = setTimeout(() => openAuthModal({ mode: "login" }), 400);
    return () => clearTimeout(timer);
  }, [authed, tool.slug]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-8">
        <Link
          href="/tools"
          className="group inline-flex items-center gap-1.5 text-sm text-paper-faint transition-colors hover:text-paper"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" strokeWidth={1.75} />
          All tools
        </Link>
        <div className="mt-5 flex items-center gap-4">
          <IconTile name={tool.icon} size="lg" />
          <div>
            <span className="rounded-full border border-ink-line bg-ink-raised/60 px-2.5 py-0.5 text-xs text-paper-faint">
              {tool.category}
            </span>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-paper">{tool.name}</h1>
          </div>
        </div>
        <p className="mt-4 max-w-xl leading-relaxed text-paper-dim">{tool.description}</p>
      </div>

      <div className="relative">
        <div
          ref={previewRef}
          aria-hidden={!authed}
          className={cn(
            !authed &&
              "pointer-events-none max-h-[480px] select-none overflow-hidden opacity-60 blur-[2px] saturate-75 [mask-image:linear-gradient(to_bottom,#000_45%,transparent)]"
          )}
        >
          {children}
        </div>

        {!authed && (
          <div className="absolute inset-x-0 top-6 z-10 flex justify-center px-2">
            <div className="glass w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl shadow-black/30">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-brass/30 bg-brass/10 text-brass">
                <LockKeyhole className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold text-paper">Sign in to use {tool.name}</h2>
              <p className="mt-1.5 text-sm text-paper-dim">
                Create a free account to unlock all {TOOLS.length} tools. It only takes a few seconds.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={() => openAuthModal({ mode: "register" })}>Create free account</Button>
                <Button variant="secondary" onClick={() => openAuthModal({ mode: "login" })}>
                  Sign in
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
