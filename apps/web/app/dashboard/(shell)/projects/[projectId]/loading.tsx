import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-3 h-5 w-72 max-w-full" />

      <div className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="mt-3 h-2 w-full" />
        <div className="mt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-t border-border py-3 first:border-t-0">
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card border border-border bg-surface p-5 shadow-card">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-7 w-28" />
            <Skeleton className="mt-3 h-2 w-full" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex aspect-[16/10] max-h-[360px] w-full items-center justify-center rounded-card border border-border bg-surface-muted">
        <Skeleton className="h-6 w-40" />
      </div>
    </div>
  );
}
