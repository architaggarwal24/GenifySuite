import Link from "next/link";
import { ToolIcon } from "@/components/tool-icon";

const LINKS = [
  { href: "/tools/ai-agent", label: "AI agent", icon: "bot" },
  { href: "/settings/ai", label: "AI provider keys", icon: "key" },
  { href: "/settings/billing", label: "Billing", icon: "credit-card" },
  { href: "/tools", label: "All tools", icon: "sparkles" },
];

export function DashboardQuickLinks() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="focus-ring group flex items-center gap-2.5 rounded border border-ink-line bg-ink-raised px-3 py-2.5 transition-colors hover:border-brass/50"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-ink-line text-paper-dim group-hover:border-brass/50 group-hover:text-brass">
            <ToolIcon name={link.icon} />
          </span>
          <span className="text-sm text-paper-dim group-hover:text-paper">{link.label}</span>
        </Link>
      ))}
    </div>
  );
}
