import { cn } from "@/lib/utils";
import { RadioTower } from "lucide-react";

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-14 text-center", className)}>
      <RadioTower className="h-8 w-8 text-ink-muted" strokeWidth={1.5} />
      <p className="text-sm font-semibold tracking-wide text-ink">{title}</p>
      {description && <p className="max-w-sm text-xs text-ink-muted">{description}</p>}
    </div>
  );
}
