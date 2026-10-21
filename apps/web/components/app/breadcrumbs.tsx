import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  href?: string;
};

/**
 * Breadcrumb row rendered inside the page header (spec §5.7).
 * Below 640 only a back link to the parent is shown.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;

  const parent = items.length > 1 ? items[items.length - 2] : undefined;

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-3", className)}>
      <ol className="hidden h-6 items-center gap-1.5 text-sm font-medium min-[640px]:flex">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden
                  className="shrink-0 text-text-muted"
                />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="max-w-[160px] truncate text-text-muted hover:text-text hover:underline"
                  title={item.label}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "max-w-[160px] truncate",
                    isLast ? "text-text" : "text-text-muted",
                  )}
                  title={item.label}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {parent?.href ? (
        <Link
          href={parent.href}
          className="-ml-2 flex h-11 items-center gap-1.5 rounded-input px-2 text-sm font-medium text-primary hover:underline min-[640px]:hidden"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {parent.label}
        </Link>
      ) : null}
    </nav>
  );
}
