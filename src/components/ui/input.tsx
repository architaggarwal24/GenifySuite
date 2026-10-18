import { type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const fieldClasses =
  "w-full rounded-lg border border-ink-line bg-ink/60 px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-faint transition-all duration-200 hover:border-paper-faint/60 focus:border-brass/70 focus:bg-ink focus:outline-none focus:ring-4 focus:ring-brass/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldClasses, className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldClasses, className)} {...props} />
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-paper-dim", className)} {...props} />;
}
