import * as React from "react";
import { cn } from "@/lib/utils";

export type ListRowProps = {
  /** Leading element (avatar, icon, drag handle). */
  leading?: React.ReactNode;
  title: React.ReactNode;
  supporting?: React.ReactNode;
  /** Right-hand status or actions. */
  trailing?: React.ReactNode;
  className?: string;
};

/** Two-line list row used in the Team and Pages lists (spec §5.11, §5.12). */
export function ListRow({ leading, title, supporting, trailing, className }: ListRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[72px] items-center gap-4 border-t border-border px-5 py-3 first:border-t-0",
        className,
      )}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-text">{title}</div>
        {supporting ? (
          <div className="mt-0.5 truncate text-sm text-text-muted">{supporting}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}
