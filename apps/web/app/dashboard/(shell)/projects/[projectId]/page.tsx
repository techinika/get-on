import { notFound, redirect } from "next/navigation";
import { Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { StatCard } from "@/components/app/stat-card";
import { PublishCard } from "@/components/project/publish-card";
import { OpenHelpButton } from "@/components/app/open-help-button";
import { buttonVariants } from "@/components/ui/button";
import { Checklist } from "@/components/project/checklist";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { planLimits } from "@/lib/team";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";
import { siteStateOf } from "@/lib/publishing/status";

type Params = { params: Promise<{ projectId: string }> };

type ProjectRow = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  settings: unknown;
  review_state: string | null;
  suspended_at: string | null;
};

type ProjectSettings = {
  contact?: { phone?: string; email?: string; address?: string };
  logoData?: string | null;
};

export default async function OverviewPage({ params }: Params) {
  const { projectId } = await params;
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("projects")
    .select("id, name, subdomain, status, settings, review_state, suspended_at")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();

  const project = row as ProjectRow | null;
  if (!project) {
    notFound();
  }

  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, is_homepage, blocks")
    .eq("project_id", projectId);

  const { data: livePublish } = await supabase
    .from("publishes")
    .select("id, created_at, live_at")
    .eq("project_id", projectId)
    .eq("status", "live")
    .maybeSingle();

  const { data: hasChanges } = await supabase.rpc("project_has_unpublished_changes", {
    p_project_id: projectId,
  });

  const pageRows = pages ?? [];
  const homepage = pageRows.find((page) => page.is_homepage) ?? pageRows[0] ?? null;
  const plan = planLimits(data.currentTeam.planId);

  const settings = (project.settings ?? {}) as ProjectSettings;
  const contact = settings.contact ?? {};
  const detailsDone = Boolean(
    (contact.phone ?? "").trim() ||
      (contact.email ?? "").trim() ||
      (contact.address ?? "").trim() ||
      settings.logoData,
  );

  const used = pageRows.length;
  const address = siteAddress(readPublishConfig(), project.subdomain);
  const hasLiveVersion = Boolean(livePublish);
  const siteState = siteStateOf({
    published: project.status === "published",
    hasLiveVersion,
    hasChanges: hasChanges === true,
    reviewState: project.review_state,
    suspendedAt: project.suspended_at,
  });

  function blocksOf(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray((value as { blocks?: unknown[] }).blocks)) {
      return (value as { blocks: unknown[] }).blocks;
    }
    return [];
  }

  const homepageReady = homepage ? blocksOf(homepage.blocks).length > 0 : false;

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: data.currentTeam.name, href: "/dashboard" },
          { label: project.name },
        ]}
        title="Overview"
        description="Here is what to do next to get your website ready."
        actions={
          <>
            <Link
              href={`/dashboard/projects/${project.id}/pages`}
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              <Eye size={20} strokeWidth={1.75} aria-hidden />
              Preview
            </Link>
            {homepage ? (
              <Link
                href={`/dashboard/projects/${project.id}/pages/${homepage.id}`}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                <Pencil size={20} strokeWidth={1.75} aria-hidden />
                Edit homepage
              </Link>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-6 min-[1024px]:grid min-[1024px]:grid-cols-[minmax(0,1fr)_280px] min-[1024px]:gap-6">
        <div className="order-1 min-[1024px]:col-start-1 min-[1024px]:row-start-1">
          <Checklist
            projectId={project.id}
            subdomain={project.subdomain}
            detailsDone={detailsDone}
            customDomainAllowed={plan.customDomainAllowed}
          />
        </div>

        <div className="order-3 min-[1024px]:col-start-1 min-[1024px]:row-start-2">
          <AppCard className="flex aspect-[16/10] max-h-[360px] w-full flex-col items-center justify-center bg-surface-muted">
            <Eye size={32} strokeWidth={1.75} aria-hidden className="text-text-muted" />
            <p className="mt-3 text-base text-text-muted">Your homepage preview will appear here</p>
          </AppCard>
        </div>

        <div className="order-2 flex flex-col gap-4 min-[1024px]:col-start-2 min-[1024px]:row-start-1 min-[1024px]:row-span-2">
          <PublishCard
            projectId={project.id}
            name={project.name}
            address={address}
            state={siteState}
            hasLiveVersion={hasLiveVersion}
            pagesCount={used}
            homepageReady={homepageReady}
            detailsReady={detailsDone}
            lastPublishedAt={livePublish?.live_at ?? livePublish?.created_at ?? null}
          />

          <StatCard
            label="Pages"
            value={`${used} of ${plan.maxPagesPerSite ?? "unlimited"}`}
            progress={
              plan.maxPagesPerSite === null || plan.maxPagesPerSite === 0
                ? undefined
                : (used / plan.maxPagesPerSite) * 100
            }
            progressLabel="Pages used"
          />

          <StatCard label="Storage" value={`0 MB of ${plan.storageMb} MB`} />

          <AppCard className="bg-info-soft p-4">
            <p className="text-sm text-info-text">Stuck? We are happy to help.</p>
            <OpenHelpButton className="mt-2" />
          </AppCard>
        </div>
      </div>
    </AppPage>
  );
}
