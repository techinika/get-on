import { cn } from "@/lib/utils";

export type ProgressProps = {
  /** 0–100. */
  value: number;
  /** When true the fill uses --accent (used 80–100% usage, spec §1.4). */
  warning?: boolean;
  label: string;
  className?: string;
};

export function Progress({ value, warning, label, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-border", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          warning ? "bg-accent" : "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
