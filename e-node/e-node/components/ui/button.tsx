import { cn } from "@/lib/utils";
import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const variants: Record<Variant, string> = {
  primary: "bg-telemetry text-white hover:opacity-90",
  secondary: "bg-surface-raised text-ink border border-border hover:bg-ink/5",
  ghost: "text-ink-muted hover:text-ink hover:bg-ink/5",
  destructive: "bg-critical text-white hover:opacity-90",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
      variants[variant],
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
