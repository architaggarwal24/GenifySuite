import { HeroGenerator } from "@/components/hero-generator";
import { ToolGrid } from "@/components/tool-grid";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight text-paper sm:text-5xl">
            Every dev utility you reach for twice a day, in one place.
          </h1>
          <p className="mt-5 max-w-md text-paper-dim">
            Card validation, test data, and generators for the small jobs that come up while
            building and testing software. No setup, nothing to install — sign in if you want
            to keep a history of what you've generated.
          </p>
        </div>
        <HeroGenerator />
      </div>

      <div className="mt-20 border-t border-ink-line pt-12">
        <ToolGrid />
      </div>
    </div>
  );
}
