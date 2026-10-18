"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/ai", label: "AI provider keys" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/account", label: "Account" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-8 inline-flex gap-1 rounded-xl border border-ink-line bg-ink-raised/60 p-1 backdrop-blur-sm">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "focus-ring rounded-lg px-3.5 py-1.5 text-sm transition-all",
            pathname === tab.href
              ? "bg-brass/15 text-paper shadow-glow-sm"
              : "text-paper-faint hover:bg-paper/5 hover:text-paper-dim"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
