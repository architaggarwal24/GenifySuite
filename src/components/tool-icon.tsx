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
