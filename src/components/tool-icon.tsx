import {
  Bot,
  Bug,
  Clock,
  CreditCard,
  Database,
  FileJson,
  Globe,
  Hash,
  KeyRound,
  type LucideIcon,
  Palette,
  ScanLine,
  Server,
  Sparkles,
  SquareTerminal,
  Type,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Maps the plain-string icon names stored in tools-registry.ts to actual
// components. Kept separate from the registry so that data file stays a
// pure data module with no React/bundle-size cost for anything that only
// needs the metadata (e.g. it's imported from server code too).
const ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  bug: Bug,
  clock: Clock,
  database: Database,
  server: Server,
  "credit-card": CreditCard,
  "file-json": FileJson,
  globe: Globe,
  hash: Hash,
  key: KeyRound,
  palette: Palette,
  "scan-line": ScanLine,
  sparkles: Sparkles,
  terminal: SquareTerminal,
  type: Type,
  user: UserRound,
};

export const ICON_NAMES = Object.keys(ICONS);

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={cn("h-4 w-4", className)} strokeWidth={1.75} />;
}

/** Icon in a rounded, tinted tile - used on cards, headers and the quick links. */
export function IconTile({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "h-12 w-12 rounded-xl" : size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  const icon = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-brass/25 bg-gradient-to-br from-brass/20 to-cyan-glow/10 text-brass transition-all duration-300 group-hover:border-brass/50 group-hover:shadow-glow-sm",
        box,
        className
      )}
    >
      <ToolIcon name={name} className={icon} />
    </span>
  );
}
