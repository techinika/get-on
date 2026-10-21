import * as React from "react";
import { cn } from "@/lib/utils";

export type SectionProps = {
  title?: string;
  description?: string;
  /** Optional right-hand action in the section title row. */
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

/** A titled block on a page (spec §5.11). Sections are 32 apart. */
export function Section({
  title,
  description,
  action,
  className,
  children,
}: SectionProps) {
  return (
    <section className={cn("mb-8", className)}>
      {title ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-section-title text-text">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-text-muted">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      {children ? <div className={cn(title ? "mt-4" : undefined)}>{children}</div> : null}
    </section>
  );
}
