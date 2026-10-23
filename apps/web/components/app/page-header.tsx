import * as React from "react";
import { Breadcrumbs, type Crumb } from "@/components/app/breadcrumbs";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  breadcrumbs?: Crumb[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Optional underline tab row rendered under the title block. */
  tabs?: React.ReactNode;
  className?: string;
};

/** Page header (spec §5.11): breadcrumb row, title block, right-hand actions. */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
  tabs,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6 min-[640px]:mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between min-[640px]:gap-4">
        <div className="min-w-0">
          <h1 className="text-page-title text-text">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-[60ch] text-base leading-6 text-text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 min-[640px]:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {tabs ? (
        <div className="mt-6 border-b border-border">{tabs}</div>
      ) : null}
    </header>
  );
}
