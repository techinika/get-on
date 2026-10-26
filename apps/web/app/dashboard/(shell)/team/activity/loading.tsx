import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";

export default function TeamActivityLoading() {
  return (
    <AppPage width="wide">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-40 animate-pulse rounded bg-surface-muted motion-reduce:animate-none" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-muted motion-reduce:animate-none" />
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-9 w-20 animate-pulse rounded-pill bg-surface-muted motion-reduce:animate-none" />
        ))}
      </div>
      <AppCard className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className="flex min-h-16 items-start gap-3 px-5 py-3">
              <div className="mt-0.5 size-9 shrink-0 animate-pulse rounded-input bg-surface-muted motion-reduce:animate-none" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-surface-muted motion-reduce:animate-none" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-surface-muted motion-reduce:animate-none" />
              </div>
            </li>
          ))}
        </ul>
      </AppCard>
    </AppPage>
  );
}
