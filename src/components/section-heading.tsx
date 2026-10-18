import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small pill label used above section titles. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 px-3 py-1 text-xs font-medium text-brass",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className={cn("text-3xl font-semibold tracking-tight text-paper sm:text-4xl", eyebrow && "mt-4")}>{title}</h1>
      {description && <p className="mt-3 text-base leading-relaxed text-paper-dim">{description}</p>}
    </div>
  );
}
