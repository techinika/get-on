import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type StatCardProps = {
  label: string;
  value: string;
  icon?: React.ReactNode;
  /** Optional progress bar (0–100). */
  progress?: number;
  progressLabel?: string;
  warning?: boolean;
  hint?: string;
  className?: string;
};

/** Small statistic card used in summaries and sidebars (spec §5.11, §6.5). */
export function StatCard({
  label,
  value,
  icon,
  progress,
  progressLabel,
  warning,
  hint,
  className,
}: StatCardProps) {
  return (
    <div className={cn("app-card p-4", className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-accent-soft text-accent-text"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-muted">{label}</p>
          <p className="text-stat-number text-text">{value}</p>
        </div>
      </div>
      {typeof progress === "number" ? (
        <Progress
          className="mt-2"
          value={progress}
          warning={warning}
          label={progressLabel ?? label}
        />
      ) : null}
      {hint ? <p className="mt-2 text-sm text-text-muted">{hint}</p> : null}
    </div>
  );
}
