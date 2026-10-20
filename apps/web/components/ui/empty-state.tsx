import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-dialog border-2 border-dashed border-border-strong px-8 py-12 text-center",
        className,
      )}
    >
      {icon}
      <h2 className="mt-6 text-h3">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-[420px] text-base text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
