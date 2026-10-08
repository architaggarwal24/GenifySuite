import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-ink-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-paper-faint sm:flex-row sm:items-center sm:justify-between">
        <p>GenifySuite — utilities for building and testing software.</p>
        <div className="flex gap-5">
          <Link href="/tools" className="hover:text-paper-dim">Tools</Link>
          <Link href="/about" className="hover:text-paper-dim">About</Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-paper-dim"
          >
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}
