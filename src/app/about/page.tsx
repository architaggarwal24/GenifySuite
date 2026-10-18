import { PageHeader } from "@/components/section-heading";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <PageHeader eyebrow="Our story" title="About GenifySuite" />
      <div className="mt-10 space-y-5 text-base leading-relaxed text-paper-dim">
        <p>
          GenifySuite started as a small HTML/CSS/JS project for learning the fundamentals of
          front-end development: a credit card validator, a few data generators, and an IP
          lookup tool, all wired together with plain JavaScript. This version is a rebuild of
          that project as a proper full-stack app — same idea, sturdier foundation.
        </p>
        <p>
          Every tool is meant to answer one narrow, recurring need during development or QA:
          checking whether a card number is well-formed, filling a form with placeholder data,
          generating a password that won't show up in a wordlist, or turning a URL into a QR
          code without opening a design tool.
        </p>
        <p>
          Sign in and any tool with a "Save to history" button will keep a record you can come
          back to from your dashboard. Nothing is saved unless you ask for it to be.
        </p>
        <p>
          The test-card generator produces Luhn-valid dummy numbers for exercising checkout-form
          validation. It only uses the generic prefixes networks publish for testing (like
          Stripe's well-known <code className="rounded-md border border-ink-line bg-ink-raised px-1.5 py-0.5 font-mono text-sm text-paper">4242 4242 4242 4242</code>{" "}
          pattern) — it does not accept an arbitrary bank identification number, and it does not
          simulate a card balance. Those numbers are not associated with real accounts and cannot
          be charged.
        </p>
      </div>
    </div>
  );
}
