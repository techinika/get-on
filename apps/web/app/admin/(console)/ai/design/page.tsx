import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { buttonVariants } from "@/components/ui/button";
import { getAiDesignOverview } from "@/lib/admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function percent(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

export default async function AdminDesignAccuracyPage() {
  const report = await getAiDesignOverview();

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "AI", href: "/admin/ai" },
          { label: "Design accuracy" },
        ]}
        title="Design accuracy"
        description="How closely AI design results matched requests in the last 30 days. Only counts are shown."
        actions={
          <Link
            href="/admin/ai"
            className={cn(buttonVariants({ variant: "ghost", size: "md" }))}
          >
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
            AI
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Design checks</p>
          <p className="text-stat-number mt-1 text-text">{report.checks}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Average match</p>
          <p className="text-stat-number mt-1 text-text">{percent(report.average)}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Unmet requests</p>
          <p className="text-stat-number mt-1 text-text">{report.unmet}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Looks applied</p>
          <p className="text-stat-number mt-1 text-text">{report.applied}</p>
        </AppCard>
      </div>

      <Section title="By design type">
        {report.archetypes.length === 0 ? (
          <AppCard className="p-6">
            <p className="text-base text-text-muted">No design checks in this period.</p>
          </AppCard>
        ) : (
          <AppCard className="p-6">
            <div className="flex flex-col gap-4">
              {report.archetypes.map((row) => (
                <div key={row.name}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold capitalize text-text">
                      {row.name.replaceAll("-", " ")}
                    </p>
                    <p className="text-sm text-text-muted">
                      {row.total} · {percent(row.accuracy)}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-pill bg-surface-muted">
                    <div
                      className="h-full rounded-pill bg-primary"
                      style={{ width: `${Math.max(2, Math.round(row.accuracy * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AppCard>
        )}
      </Section>

      <p className="mt-6 text-sm text-text-muted">
        {report.unsupported} requests could not be matched in this period.
      </p>
    </AppPage>
  );
}
