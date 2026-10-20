import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function PagesLoading() {
  return (
    <div aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="mt-2 h-4 w-44" />
        </div>
        <Skeleton
          className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full sm:w-auto")}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface shadow-card">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex h-[72px] items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
          >
            <Skeleton className="h-11 w-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
            <Skeleton className="hidden h-6 w-16 shrink-0 xs:block" />
            <Skeleton className="h-9 w-16 shrink-0" />
            <Skeleton className="h-11 w-11 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
