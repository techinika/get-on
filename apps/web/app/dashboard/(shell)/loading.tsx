import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div aria-busy aria-label="Loading your websites">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-11 w-40" />
      </div>
      <Card className="mt-6 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </Card>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="aspect-[4/3] rounded-card" />
        <Skeleton className="aspect-[4/3] rounded-card" />
        <Skeleton className="aspect-[4/3] rounded-card" />
      </div>
    </div>
  );
}
