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
    <div className="mb-8 flex gap-1 border-b border-ink-line">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "focus-ring -mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            pathname === tab.href
              ? "border-brass text-paper"
              : "border-transparent text-paper-faint hover:text-paper-dim"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
