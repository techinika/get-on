import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ReportRow = {
  id: string;
  accuracy: number | string | null;
  unmet: unknown;
  unsupported: unknown;
  archetype: string | null;
  created_at: string;
};

type UnsupportedRow = {
  text: string;
  nearest: string | null;
  count: number | null;
  updated_at: string;
};

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function percent(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function day(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export default async function AdminDesignAccuracyPage() {
  const admin = createAdminClient();
  const since = daysAgo(30);

  const [reportsResult, unsupportedResult, appliedResult] = await Promise.all([
    admin
      .from("ai_design_reports")
      .select("id, accuracy, unmet, unsupported, archetype, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("ai_unsupported_requests")
      .select("text, nearest, count, updated_at")
      .order("count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(20),
    admin
      .from("ai_design_history")
      .select("id", { count: "exact", head: true })
      .not("applied_at", "is", null)
      .gte("created_at", since),
  ]);

  const reports = (reportsResult.data ?? []) as ReportRow[];
  const unsupported = (unsupportedResult.data ?? []) as UnsupportedRow[];
  const applied = appliedResult.count ?? 0;

  const average =
    reports.length === 0
      ? 0
      : reports.reduce((sum, row) => sum + Number(row.accuracy ?? 0), 0) /
        reports.length;
  const unmet = reports.reduce((sum, row) => sum + count(row.unmet), 0);
  const unsupportedCount = reports.reduce(
    (sum, row) => sum + count(row.unsupported),
    0,
  );

  const archetypes = new Map<string, { total: number; accuracy: number }>();
  for (const report of reports) {
    const key = report.archetype ?? "unknown";
    const current = archetypes.get(key) ?? { total: 0, accuracy: 0 };
    current.total += 1;
    current.accuracy += Number(report.accuracy ?? 0);
    archetypes.set(key, current);
  }
  const archetypeRows = [...archetypes.entries()]
    .map(([name, value]) => ({
      name,
      total: value.total,
      accuracy: value.total ? value.accuracy / value.total : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "AI", href: "/admin/ai" },
          { label: "Design accuracy" },
        ]}
        title="Design accuracy"
        description="How closely AI looks matched the requests people made in the last 30 days."
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
          <p className="text-stat-number mt-1 text-text">{reports.length}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Average match</p>
          <p className="text-stat-number mt-1 text-text">{percent(average)}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Unmet requests</p>
          <p className="text-stat-number mt-1 text-text">{unmet}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Looks applied</p>
          <p className="text-stat-number mt-1 text-text">{applied}</p>
        </AppCard>
      </div>

      <Section title="Requests we cannot meet yet">
        {unsupported.length === 0 ? (
          <AppCard className="p-6">
            <p className="text-base text-text-muted">
              Nothing has been recorded yet. Unsupported design requests appear here.
            </p>
          </AppCard>
        ) : (
          <AppCard className="overflow-hidden p-0">
            <div className="divide-y divide-border">
              {unsupported.map((row) => (
                <div
                  key={`${row.text}-${row.updated_at}`}
                  className="flex flex-wrap items-start justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">{row.text}</p>
                    {row.nearest ? (
                      <p className="mt-1 text-sm text-text-muted">Suggested: {row.nearest}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{Number(row.count ?? 1)} times</Badge>
                    <span className="text-sm text-text-muted">{day(row.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </AppCard>
        )}
      </Section>

      <Section title="By design type">
        {archetypeRows.length === 0 ? (
          <AppCard className="p-6">
            <p className="text-base text-text-muted">No design checks in this period.</p>
          </AppCard>
        ) : (
          <AppCard className="p-6">
            <div className="flex flex-col gap-4">
              {archetypeRows.map((row) => (
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

      <Section title="Recent checks">
        {reports.length === 0 ? (
          <AppCard className="p-6">
            <p className="text-base text-text-muted">No design checks in this period.</p>
          </AppCard>
        ) : (
          <AppCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-sm text-text-muted">
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium">Design type</th>
                    <th className="p-4 font-medium">Match</th>
                    <th className="p-4 font-medium">Unmet</th>
                    <th className="p-4 font-medium">Not available</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.slice(0, 20).map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="p-4 text-sm text-text-muted">{day(row.created_at)}</td>
                      <td className="p-4 text-sm capitalize text-text">
                        {(row.archetype ?? "unknown").replaceAll("-", " ")}
                      </td>
                      <td className="p-4 text-sm text-text">{percent(Number(row.accuracy ?? 0))}</td>
                      <td className="p-4 text-sm text-text">{count(row.unmet)}</td>
                      <td className="p-4 text-sm text-text">{count(row.unsupported)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AppCard>
        )}
      </Section>

      <p className="mt-6 text-sm text-text-muted">
        Unsupported requests: {unsupportedCount} in this period.{" "}
        <Link href="/admin/ai" className="font-semibold text-primary hover:underline">
          Back to AI settings
          <ArrowRight size={14} strokeWidth={2} aria-hidden className="ml-1 inline" />
        </Link>
      </p>
    </AppPage>
  );
}
