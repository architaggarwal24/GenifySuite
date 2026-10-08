import Link from "next/link";
import { getToolBySlug } from "@/lib/tools-registry";

interface ToolCount {
  tool: string;
  count: number;
}

export function ToolUsageBars({ items }: { items: ToolCount[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-paper-faint">No saved items yet.</p>;
  }

  const max = Math.max(...items.map((i) => i.count));

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const meta = getToolBySlug(item.tool);
        return (
          <Link
            key={item.tool}
            href={meta ? `/tools/${item.tool}` : "/tools"}
            className="focus-ring group block"
          >
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-paper-dim group-hover:text-paper">{meta?.name ?? item.tool}</span>
              <span className="font-mono text-paper-faint">{item.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-sm bg-ink">
              <div
                className="h-full rounded-sm bg-sage/70 transition-colors group-hover:bg-sage"
                style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
