import Link from "next/link";
import { ToolIcon } from "@/components/tool-icon";
import { CATEGORY_ORDER, TOOLS } from "@/lib/tools-registry";

export function ToolGrid() {
  return (
    <div className="space-y-10">
      {CATEGORY_ORDER.map((category) => {
        const tools = TOOLS.filter((tool) => tool.category === category);
        return (
          <section key={category}>
            <h2 className="mb-4 text-sm font-medium text-paper-dim">{category}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="focus-ring group relative rounded border border-ink-line bg-ink-raised p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-lg hover:shadow-black/20"
                >
                  <span className="absolute left-0 top-3 h-3 w-px bg-ink-line group-hover:bg-brass/50" />
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-ink-line text-paper-dim transition-colors group-hover:border-brass/50 group-hover:text-brass">
                      <ToolIcon name={tool.icon} />
                    </span>
                    <h3 className="font-display text-base font-medium text-paper">{tool.name}</h3>
                  </div>
                  <p className="mt-2 text-sm text-paper-faint">{tool.description}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
