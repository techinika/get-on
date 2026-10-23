import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppPage, type AppPageWidth } from "@/components/app/app-page";
import { cn } from "@/lib/utils";

export type SkeletonPageProps = {
  width?: AppPageWidth;
  /** Show the breadcrumb bar. */
  breadcrumbs?: boolean;
  /** Number of card skeletons rendered in the main block. */
  cards?: number;
  /** Row skeletons instead of cards (used by list pages). */
  rows?: number;
  className?: string;
};

/**
 * Loading placeholder that matches the final page dimensions so the layout
 * does not shift when data arrives (spec §6.7).
 */
export function SkeletonPage({
  width = "default",
  breadcrumbs = true,
  cards = 0,
  rows = 0,
  className,
}: SkeletonPageProps) {
  return (
    <AppPage width={width} className={className}>
      <div aria-busy aria-label="Loading">
        {breadcrumbs ? <Skeleton className="mb-3 h-4 w-40" /> : null}
        <Skeleton className="h-7 w-60" />
        <Skeleton className="mt-3 h-5 w-80 max-w-full" />
        {cards > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {Array.from({ length: cards }).map((_, i) => (
              <div key={i} className="app-card overflow-hidden">
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {rows > 0 ? (
          <div className="app-card mt-8 divide-y divide-border">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
                <Skeleton className="h-6 w-16 rounded-pill" />
              </div>
            ))}
          </div>
        ) : null}
        {!cards && !rows ? (
          <div className={cn("app-card mt-8 h-40 w-full")} />
        ) : null}
      </div>
    </AppPage>
  );
}
