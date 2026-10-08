import { type ReactNode } from "react";
import Link from "next/link";
import { ToolIcon } from "@/components/tool-icon";
import { type ToolMeta } from "@/lib/tools-registry";

export function ToolShell({ tool, children }: { tool: ToolMeta; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-8">
        <Link href="/tools" className="text-sm text-paper-faint hover:text-paper-dim">
          ← All tools
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-brass/40 text-brass">
            <ToolIcon name={tool.icon} className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-semibold text-paper">{tool.name}</h1>
          <span className="rounded-sm border border-ink-line px-2 py-0.5 text-xs text-paper-faint">
            {tool.category}
          </span>
        </div>
        <p className="mt-2 max-w-xl text-paper-dim">{tool.description}</p>
      </div>
      {children}
    </div>
  );
}
