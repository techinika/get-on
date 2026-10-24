import Link from "next/link";
import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";

type Params = { params: Promise<{ projectId: string }> };

export default async function VisitorsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let published = false;
  let counting = true;
  if (current) {
    const supabase = await createClient();
    const [{ data: project }, { data: settings }] = await Promise.all([
      supabase
        .from("projects")
        .select("status")
        .eq("id", projectId)
        .eq("team_id", current.team.teamId)
        .maybeSingle(),
      supabase
        .from("project_settings")
        .select("stats_enabled")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);
    published = project?.status === "published";
    counting = settings?.stats_enabled !== false;
  }

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: "Project", href: `/dashboard/projects/${projectId}` },
          { label: "Visitors" },
        ]}
        title="Visitors"
        description="How many people visit your website."
      />

      <AppCard className="max-w-[960px] p-6">
        {!published ? (
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-[17px] font-semibold text-text">Publish your website to start counting</h2>
            <p className="text-[15px] text-text-muted">
              Visitor numbers appear after your website is live. We never store IP addresses, and we respect &quot;Do Not Track&quot;.
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
              Turn it on to see how many people visit your website. Numbers are kept for 90 days.
            </p>
            <Link
              href={`/dashboard/projects/${projectId}/settings/analytics`}
              className="inline-flex h-11 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
            >
              Turn counting on
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-[17px] font-semibold text-text">No visitors yet</h2>
            <p className="text-[15px] text-text-muted">
              When people visit your website, their visits show up here within a few minutes. Numbers are kept for 90 days and never include personal details.
            </p>
          </div>
        )}
      </AppCard>
    </AppPage>
  );
}
