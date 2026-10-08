"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/tools", label: "Tools" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 focus-ring rounded" onClick={() => setOpen(false)}>
          <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-brass text-sm font-display font-semibold text-brass">
            G
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-paper">
            GenifySuite
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "focus-ring rounded text-sm transition-colors",
                pathname.startsWith(link.href) ? "text-brass" : "text-paper-dim hover:text-paper"
              )}
            >
              {link.label}
            </Link>
          ))}
          {status === "authenticated" && (
            <>
              <Link
                href="/dashboard"
                className={cn(
                  "focus-ring rounded text-sm transition-colors",
                  pathname.startsWith("/dashboard") ? "text-brass" : "text-paper-dim hover:text-paper"
                )}
              >
                Dashboard
              </Link>
              <Link
                href="/settings/ai"
                className={cn(
                  "focus-ring rounded text-sm transition-colors",
                  pathname.startsWith("/settings") ? "text-brass" : "text-paper-dim hover:text-paper"
                )}
              >
                Settings
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("genifysuite:open-command-palette"))}
            className="focus-ring hidden items-center gap-2 rounded border border-ink-line px-2.5 py-1.5 text-xs text-paper-faint transition-colors hover:border-paper-dim hover:text-paper-dim sm:flex"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden md:inline">Search tools</span>
            <kbd className="rounded-sm border border-ink-line bg-ink px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>

          <div className="hidden items-center gap-3 md:flex">
            {status === "authenticated" ? (
              <>
                <span className="text-sm text-paper-faint">{session.user?.email}</span>
                <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="focus-ring rounded text-sm text-paper-dim hover:text-paper">
                  Sign in
                </Link>
                <Link href="/register">
                  <Button size="sm">Create account</Button>
                </Link>
              </>
            )}
          </div>

          <ThemeToggle />

          <button
            className="focus-ring rounded p-2 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            <div className="flex flex-col gap-1.5">
              <span className={cn("h-px w-5 bg-paper transition-transform", open && "translate-y-[6.5px] rotate-45")} />
              <span className={cn("h-px w-5 bg-paper transition-opacity", open && "opacity-0")} />
              <span className={cn("h-px w-5 bg-paper transition-transform", open && "-translate-y-[6.5px] -rotate-45")} />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-ink-line px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-paper-dim" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            {status === "authenticated" ? (
              <>
                <Link href="/dashboard" className="text-sm text-paper-dim" onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/settings/ai" className="text-sm text-paper-dim" onClick={() => setOpen(false)}>
                  Settings
                </Link>
                <button
                  className="text-left text-sm text-rust"
                  onClick={() => {
                    setOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-paper-dim" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
                <Link href="/register" className="text-sm text-brass" onClick={() => setOpen(false)}>
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
