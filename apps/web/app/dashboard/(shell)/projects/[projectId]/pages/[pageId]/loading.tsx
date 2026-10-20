import { Skeleton } from "@/components/ui/skeleton";

export default function PageEditorLoading() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-11 w-20" />
      <Skeleton className="mt-1 h-9 w-72 max-w-full" />
      <div className="mt-4 rounded-info bg-info-soft px-4 py-3.5">
        <Skeleton className="h-5 w-full max-w-[420px]" />
      </div>
      <div className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
        <Skeleton className="h-6 w-52" />
        <div className="mt-4 rounded-info border border-border bg-surface p-6">
          <Skeleton className="h-8 w-2/3 max-w-full" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
        </div>
        <Skeleton className="mt-4 h-11 w-40" />
      </div>
    </div>
  );
}
