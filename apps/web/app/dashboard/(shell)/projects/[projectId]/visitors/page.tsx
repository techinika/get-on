import Link from "next/link";
import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { PLAN_BY_ID } from "@/lib/plans";
import { getCurrentTeam } from "@/lib/team";
import { VisitorStats } from "./visitor-stats";

type Params = { params: Promise<{ projectId: string }> };

export default async function VisitorsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let projectName = "your website";
  let published = false;
  let counting = true;
  let planHistoryDays: number | null = 90;
  let plan = "Free";

  if (current) {
    const supabase = await createClient();
    const [{ data: project }, { data: livePublish }, { data: settings }, { data: planRow }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("name, status")
          .eq("id", projectId)
          .eq("team_id", current.team.teamId)
          .maybeSingle(),
        supabase
          .from("publishes")
          .select("id")
          .eq("project_id", projectId)
          .eq("status", "live")
          .maybeSingle(),
        supabase
          .from("project_settings")
          .select("stats_enabled")
          .eq("project_id", projectId)
          .maybeSingle(),
        supabase
          .from("plans")
          .select("name, priority_class")
          .eq("id", current.team.planId)
          .maybeSingle(),
      ]);

    if (typeof project?.name === "string" && project.name.trim()) {
      projectName = project.name.trim();
    }
    published = project?.status === "published" || Boolean(livePublish?.id);
    counting = settings?.stats_enabled !== false;

    const historyMap: Record<string, number | null> = {
      free: 90,
      basic: 365,
      pro: 730,
      enterprise: null,
    };
    plan = planRow?.name ?? PLAN_BY_ID[current.team.planId]?.name ?? "Free";
    const key = String(planRow?.priority_class ?? current.team.planId);
    planHistoryDays = key in historyMap ? (historyMap[key] ?? null) : 90;
  }

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: "Project", href: `/dashboard/projects/${projectId}` },
          { label: "Visitors" },
        ]}
        title="Visitors"
        description={`How many people visit ${projectName} and where they come from.`}
      />

      {!published ? (
        <AppCard className="max-w-[960px] p-6">
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
        </AppCard>
      ) : !counting ? (
        <AppCard className="max-w-[960px] p-6">
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-[17px] font-semibold text-text">Visitor counting is off</h2>
            <p className="text-[15px] text-text-muted">
              Turn it on to see how many people visit your website and where they come from.
              {planHistoryDays !== null ? ` Numbers are kept for ${planHistoryDays} days.` : ""}
            </p>
            <Link
              href={`/dashboard/projects/${projectId}/settings/analytics`}
              className="inline-flex h-11 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
            >
              Turn counting on
            </Link>
          </div>
        </AppCard>
      ) : (
        <div className="flex max-w-[1040px] flex-col gap-6">
          <VisitorStats projectId={projectId} />

          {planHistoryDays !== null ? (
            <AppCard className="p-4 text-[14px] text-text-muted">
              Your {plan} plan keeps up to {planHistoryDays} days of visit totals, and Cloudflare Analytics provides detailed country and source breakdowns for the last 30 days.{" "}
              <Link href="/dashboard/plan" className="font-semibold text-primary hover:underline">
                See plans
              </Link>
            </AppCard>
          ) : null}
        </div>
      )}
    </AppPage>
  );
}