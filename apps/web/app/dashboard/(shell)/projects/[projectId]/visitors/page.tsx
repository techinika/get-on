import Link from "next/link";
import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { VisitorStats } from "./visitor-stats";

type Params = { params: Promise<{ projectId: string }> };

export default async function VisitorsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let published = false;
  let counting = true;
  let planHistoryMonths = 0;
  let plan = "Free";

  if (current) {
    const supabase = await createClient();
    const [{ data: project }, { data: settings }, { data: planRow }] = await Promise.all([
      supabase
        .from("projects")
        .select("status, plan_id")
        .eq("id", projectId)
        .eq("team_id", current.team.teamId)
        .maybeSingle(),
      supabase
        .from("project_settings")
        .select("stats_enabled")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("plans")
        .select("name, priority_class, priority_label")
        .eq("id", project?.plan_id)
        .maybeSingle(),
    ]);

    published = project?.status === "published";
    counting = settings?.stats_enabled !== false;

    if (planRow) {
      plan = planRow.name;
      const historyMap: Record<string, number> = {
        free: 90,
        basic: 365,
        pro: 730,
        enterprise: null,
      };
      planHistoryMonths = historyMap[planRow.priority_class] || 90;
    }
  }

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: "Project", href: `/dashboard/projects/${projectId}` },
          { label: "Visitors" },
        ]}
        title="Visitors"
        description="How many people visit {project name}."
      />

      <AppCard className="max-w-[960px] p-6">
        {!published ? (
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-[17px] font-semibold text-text">Publish your website to start counting</h2>
            <p className="text-[15px] text-text-muted">
              Visitor numbers appear after your website is live. We never store IP addresses, and we respect &ldquo;Do Not Track&rdquo;.
            </p>
            <Link
              href={`/dashboard/projects/${projectId}/publish`}
              className="inline-flex h-11 items-center justify-center rounded-input bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-hover"
            >
              Go to publishing
            </Link>
          </div>
        ) : !counting ? (
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-[17px] font-semibold text-text">Visitor counting is off</h2>
            <p className="text-[15px] text-text-muted">
              Turn it on to see how many people visit your website. Numbers are kept for {planHistoryMonths} months.
            </p>
            <Link
              href={`/dashboard/projects/${projectId}/settings/analytics`}
              className="inline-flex h-11 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
            >
              Turn counting on
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-start gap-3">
              <h2 className="text-[17px] font-semibold text-text">No visitors yet</h2>
              <p className="text-[15px] text-text-muted">
                When people visit your website, their visits show up here within a few minutes. Numbers are kept for {planHistoryMonths} months and never include personal details.
                {planHistoryMonths !== null && (
                  <p className="text-[14px] text-text-muted mt-2">
                    Your {plan} plan shows {planHistoryMonths} months of history. Upgrade to see older numbers.
                  </p>
                )}
              </p>
            </div>

            <VisitorStats projectId={projectId} />

            {/* Plan history strip at bottom */}
            {planHistoryMonths !== null && (
              <div className="mt-8 pt-8 border-t border-border-strong text-[14px] text-text-muted">
                Your {plan} plan shows {planHistoryMonths} months of history.
                We keep your numbers, so older months appear when you upgrade.
                <Link
                  href={`/dashboard/plan`}
                  className="font-semibold text-primary hover:underline"
                >
                  See plans
                </Link>
              </div>
            )}
          </>
        )}
      </AppCard>
    </AppPage>
  );
}