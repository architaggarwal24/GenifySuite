"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { openAuthModal } from "@/lib/auth-modal";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/tools", label: "Tools" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const authedLinks =
    status === "authenticated"
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/settings/ai", label: "Settings", match: "/settings" },
        ]
      : [];
  const links: { href: string; label: string; match?: string }[] = [...NAV_LINKS, ...authedLinks];

  const isActive = (link: { href: string; match?: string }) => pathname.startsWith(link.match ?? link.href);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto max-w-6xl rounded-2xl border border-transparent transition-all duration-300",
          scrolled && "glass shadow-card"
        )}
      >
        <div className="flex h-14 items-center justify-between gap-4 px-3 sm:px-4">
          <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg" onClick={() => setOpen(false)}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brass to-cyan-glow font-display text-sm font-bold text-white shadow-glow-sm">
              G
            </span>
            <span className="font-display text-base font-semibold tracking-tight text-paper">GenifySuite</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "focus-ring relative rounded-lg px-3 py-1.5 text-sm transition-colors",
                  isActive(link) ? "bg-brass/10 text-paper" : "text-paper-dim hover:bg-paper/5 hover:text-paper"
                )}
              >
                {link.label}
                {isActive(link) && (
                  <span className="absolute inset-x-3 -bottom-[7px] h-px bg-gradient-to-r from-transparent via-brass to-transparent" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("genifysuite:open-command-palette"))}
              className="focus-ring hidden items-center gap-2 rounded-lg border border-ink-line bg-ink/40 px-2.5 py-1.5 text-xs text-paper-faint transition-colors hover:border-brass/40 hover:text-paper-dim sm:flex"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden lg:inline">Search tools</span>
              <kbd className="rounded-md border border-ink-line bg-ink px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>

            <div className="hidden items-center gap-2 md:flex">
              {status === "authenticated" ? (
                <>
                  <span className="max-w-[160px] truncate text-sm text-paper-faint">{session.user?.email}</span>
                  <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthModal({ mode: "login" })}
                    className="focus-ring rounded-lg px-3 py-1.5 text-sm text-paper-dim transition-colors hover:text-paper"
                  >
                    Sign in
                  </button>
                  <Button size="sm" onClick={() => openAuthModal({ mode: "register" })}>
                    Get started
                  </Button>
                </>
              )}
            </div>

            <ThemeToggle />

            <button
              className="focus-ring rounded-lg p-2 md:hidden"
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
          <div className="animate-fade-slide-up border-t border-ink-line px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    isActive(link) ? "bg-brass/10 text-paper" : "text-paper-dim"
                  )}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {status === "authenticated" ? (
                <button
                  className="rounded-lg px-3 py-2 text-left text-sm text-rust"
                  onClick={() => {
                    setOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                >
                  Sign out
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-paper-dim"
                    onClick={() => {
                      setOpen(false);
                      openAuthModal({ mode: "login" });
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-brass"
                    onClick={() => {
                      setOpen(false);
                      openAuthModal({ mode: "register" });
                    }}
                  >
                    Get started
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
