import Link from "next/link";
import { IconTile } from "@/components/tool-icon";

const LINKS = [
  { href: "/tools/ai-agent", label: "AI agent", icon: "bot" },
  { href: "/settings/ai", label: "AI provider keys", icon: "key" },
  { href: "/settings/billing", label: "Billing", icon: "credit-card" },
  { href: "/tools", label: "All tools", icon: "sparkles" },
];

export function DashboardQuickLinks() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="focus-ring group flex items-center gap-3 rounded-xl border border-ink-line bg-ink-raised/70 px-3.5 py-3 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/50"
        >
          <IconTile name={link.icon} size="sm" />
          <span className="text-sm text-paper-dim transition-colors group-hover:text-paper">{link.label}</span>
        </Link>
      ))}
    </div>
  );
}
