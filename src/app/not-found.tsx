import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center">
      <p className="font-mono text-sm text-brass">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-paper">Nothing on this shelf.</h1>
      <p className="mt-2 text-paper-dim">The page you're looking for doesn't exist.</p>
      <Link
        href="/tools"
        className="focus-ring mt-6 inline-block rounded border border-brass px-4 py-2 text-sm font-medium text-brass hover:bg-brass/10"
      >
        Browse tools
      </Link>
    </div>
  );
}
