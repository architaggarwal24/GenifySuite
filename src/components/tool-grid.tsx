import { ArrowUpRight } from "lucide-react";
import { IconTile } from "@/components/tool-icon";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/spotlight-card";
import { CATEGORY_ORDER, TOOLS } from "@/lib/tools-registry";

export function ToolGrid() {
  return (
    <div className="space-y-14">
      {CATEGORY_ORDER.map((category) => {
        const tools = TOOLS.filter((tool) => tool.category === category);
        const isAi = category === "AI tools";
        return (
          <section key={category}>
            <Reveal>
              <div className="mb-5 flex items-center gap-3">
                <h2 className="font-display text-lg font-semibold text-paper">{category}</h2>
                <span className="rounded-full border border-ink-line px-2 py-0.5 font-mono text-[11px] text-paper-faint">
                  {tools.length}
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-ink-line to-transparent" />
              </div>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool, i) => (
                <Reveal key={tool.slug} delay={Math.min(i, 5) * 60}>
                  <SpotlightCard href={`/tools/${tool.slug}`} className="group h-full">
                    <div className="flex items-start justify-between">
                      <IconTile name={tool.icon} />
                      <ArrowUpRight
                        className="h-4 w-4 -translate-x-1 translate-y-1 text-paper-faint opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-brass group-hover:opacity-100"
                        strokeWidth={1.75}
                      />
                    </div>
                    <h3 className="mt-4 flex items-center gap-2 font-display text-base font-medium text-paper">
                      {tool.name}
                      {isAi && (
                        <span className="rounded-full bg-brass/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brass">
                          AI
                        </span>
                      )}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-paper-faint">{tool.description}</p>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
