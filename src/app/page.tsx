import Link from "next/link";
import { ArrowRight, Command, KeyRound, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AuthCta } from "@/components/auth-cta";
import { HeroGenerator } from "@/components/hero-generator";
import { Marquee } from "@/components/marquee";
import { Reveal } from "@/components/reveal";
import { Eyebrow } from "@/components/section-heading";
import { SpotlightCard } from "@/components/spotlight-card";
import { ToolGrid } from "@/components/tool-grid";
import { ToolIcon } from "@/components/tool-icon";
import { Button } from "@/components/ui/button";
import { CATEGORY_ORDER, TOOLS } from "@/lib/tools-registry";

const FEATURES = [
  {
    icon: Zap,
    title: "Instant, nothing to install",
    body: "Open a tool and use it. Everything runs in your browser except the IP lookup, which needs a server hop.",
  },
  {
    icon: KeyRound,
    title: "Bring your own AI key",
    body: "Use Anthropic, OpenAI, a local Ollama, NVIDIA NIM or any OpenAI-compatible endpoint — free on every plan.",
  },
  {
    icon: Command,
    title: "Keyboard-first",
    body: "Hit ⌘K from anywhere to jump to a tool, a setting or your history without touching the mouse.",
  },
  {
    icon: ShieldCheck,
    title: "Saved only when you say so",
    body: "Sign in to keep a history of what you've generated. Nothing is stored unless you press save.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* ───────── Hero ───────── */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 sm:pt-24">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <Link
              href="/tools/ai-agent"
              className="group focus-ring inline-flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 py-1 pl-1 pr-3 text-xs text-paper-dim transition-colors hover:border-brass/60"
            >
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-brass to-brass-dim px-2 py-0.5 font-medium text-white">
                <Sparkles className="h-3 w-3" /> New
              </span>
              Meet the AI agent that picks the right tool for you
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-paper sm:text-6xl">
              Every dev utility you reach for twice a day,{" "}
              <span className="text-gradient-animated">in one place.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper-dim">
              Card validation, test data, and generators for the small jobs that come up while
              building and testing software. No setup, nothing to install — sign in if you want to
              keep a history of what you&apos;ve generated.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/tools">
                <Button size="lg">
                  Browse tools <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <AuthCta variant="secondary" authedLabel="Open dashboard">
                Create free account
              </AuthCta>
            </div>
          </div>

          <HeroGenerator />
        </div>
      </section>

      {/* ───────── Tool ticker ───────── */}
      <section aria-label="Available tools" className="py-10">
        <Marquee>
          {TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              tabIndex={-1}
              className="glass flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm text-paper-dim transition-colors hover:border-brass/40 hover:text-paper"
            >
              <ToolIcon name={tool.icon} className="text-brass" />
              {tool.name}
            </Link>
          ))}
        </Marquee>
      </section>

      {/* ───────── Stats ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <Reveal>
          <dl className="grid grid-cols-2 divide-ink-line rounded-2xl border border-ink-line bg-ink-raised/50 backdrop-blur-sm sm:grid-cols-4 sm:divide-x">
            {[
              { k: String(TOOLS.length), v: "tools in the box" },
              { k: String(CATEGORY_ORDER.length), v: "categories" },
              { k: "$0", v: "to get started" },
              { k: "⌘K", v: "jump anywhere" },
            ].map((s) => (
              <div key={s.v} className="px-6 py-6 text-center">
                <dt className="sr-only">{s.v}</dt>
                <dd>
                  <span className="text-gradient font-display text-3xl font-semibold">{s.k}</span>
                  <span className="mt-1 block text-sm text-paper-faint">{s.v}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* ───────── Features ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Why GenifySuite</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Small tools, done properly.
          </h2>
          <p className="mt-3 text-paper-dim">
            Each tool answers one narrow, recurring need — and gets out of your way.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <SpotlightCard className="group h-full">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brass/25 bg-gradient-to-br from-brass/20 to-cyan-glow/10 text-brass">
                  <f.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 font-display text-base font-medium text-paper">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-paper-faint">{f.body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── All tools ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <Reveal className="mb-10 max-w-2xl">
          <Eyebrow>The toolbox</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Everything in one place.
          </h2>
        </Reveal>
        <ToolGrid />
      </section>

      {/* ───────── CTA ───────── */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-brass/25 bg-gradient-to-br from-brass/15 via-ink-raised/60 to-cyan-glow/10 px-6 py-14 text-center sm:px-12">
            <div aria-hidden className="absolute inset-0 bg-dots opacity-40 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)]" />
            <div className="relative">
              <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
                Stop hunting for that one-off tool.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-paper-dim">
                Create a free account to keep a history of everything you generate and plug in your own AI key.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <AuthCta authedLabel="Open dashboard">
                  Get started free <ArrowRight className="h-4 w-4" />
                </AuthCta>
                <Link href="/pricing">
                  <Button size="lg" variant="secondary">
                    See pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
