import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-skeleton rounded-input bg-surface-muted",
        "bg-[linear-gradient(90deg,var(--surface-muted)_0%,var(--border)_50%,var(--surface-muted)_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
