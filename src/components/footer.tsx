import Link from "next/link";
import { CATEGORY_ORDER } from "@/lib/tools-registry";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-line/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brass to-cyan-glow font-display text-sm font-bold text-white">
              G
            </span>
            <span className="font-display text-base font-semibold text-paper">GenifySuite</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper-faint">
            Utilities for building and testing software. Small tools, no setup, nothing to install.
          </p>
        </div>

        <FooterColumn title="Tools">
          {CATEGORY_ORDER.map((c) => (
            <Link key={c} href="/tools" className="hover:text-paper">
              {c}
            </Link>
          ))}
        </FooterColumn>

        <FooterColumn title="Product">
          <Link href="/pricing" className="hover:text-paper">Pricing</Link>
          <Link href="/about" className="hover:text-paper">About</Link>
          <Link href="/dashboard" className="hover:text-paper">Dashboard</Link>
        </FooterColumn>

        <FooterColumn title="Account">
          <Link href="/login" className="hover:text-paper">Sign in</Link>
          <Link href="/register" className="hover:text-paper">Create account</Link>
          <Link href="/settings/ai" className="hover:text-paper">AI provider keys</Link>
        </FooterColumn>
      </div>

      <div className="border-t border-ink-line/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-paper-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} GenifySuite</p>
          <a
            href="https://github.com/architaggarwal24/GenifySuite"
            target="_blank"
            rel="noreferrer"
            className="hover:text-paper-dim"
          >
            Source on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-paper">{title}</p>
      <div className="mt-4 flex flex-col gap-2.5 text-sm text-paper-faint">{children}</div>
    </div>
  );
}
