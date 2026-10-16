import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted/70 focus-visible:border-accent";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(control, className)} {...p} />,
);
Input.displayName = "Input";

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "appearance-none", className)} {...p} />;
}

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs uppercase tracking-wider text-muted", className)} {...p} />;
}

export function Badge({
  className,
  tone = "default",
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "accent" | "warn" | "danger" }) {
  const tones = {
    default: "border-border text-muted",
    accent: "border-accent/40 text-accent",
    warn: "border-warn/40 text-warn",
    danger: "border-danger/40 text-danger",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]", tones[tone], className)}
      {...p}
    />
  );
}
