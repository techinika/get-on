import * as React from "react";
import { cn } from "@/lib/utils";

export type AppEmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Compact variant used for inline sections (smaller padding). */
  compact?: boolean;
  className?: string;
};

/** Dashed empty state used across the dashboard (spec §6.1, §5.11). */
export function AppEmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: AppEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border-2 border-dashed border-border-strong bg-surface text-center",
        compact ? "px-6 py-8" : "px-8 py-12 min-[640px]:py-12",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-full bg-accent-soft text-accent-text",
          compact ? "h-14 w-14" : "h-24 w-24",
        )}
      >
        {icon}
      </span>
      <h2
        className={cn(
          "mt-6 font-heading font-bold text-text",
          compact ? "text-xl" : "text-[22px]",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-[420px] text-base leading-6 text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
