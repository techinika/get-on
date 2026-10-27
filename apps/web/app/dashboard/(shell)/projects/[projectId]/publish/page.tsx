import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { PublishCard } from "@/components/project/publish-card";
import {
  PublishHistory,
  type PublishHistoryRow,
} from "@/components/project/publish-history";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";
import { siteStateOf } from "@/lib/publishing/status";
import { countSampleBlocks } from "@get-on/blocks";

type Params = { params: Promise<{ projectId: string }> };

type ProjectRow = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  primary_host: string | null;
  settings: unknown;
  review_state: string | null;
  suspended_at: string | null;
};

type ProjectSettings = {
  contact?: { phone?: string; email?: string; address?: string };
  logoData?: string | null;
};

export default async function PublishHistoryPage({ params }: Params) {
  const { projectId } = await params;
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("projects")
    .select("id, name, subdomain, status, primary_host, settings, review_state, suspended_at")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();

  const project = row as ProjectRow | null;
  if (!project) {
    notFound();
  }

  const [{ data: publishes }, { data: pages }, { data: livePublish }, { data: hasChanges }, { data: contactInstall }] =
    await Promise.all([
      supabase
        .from("publishes")
        .select("id, status, created_at, live_at, pages_count, error_code, created_by")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("pages")
        .select("id, title, is_homepage, blocks")
        .eq("project_id", projectId),
      supabase
        .from("publishes")
        .select("id, created_at, live_at")
        .eq("project_id", projectId)
        .eq("status", "live")
        .maybeSingle(),
      supabase.rpc("project_has_unpublished_changes", { p_project_id: projectId }),
      supabase
        .from("plugin_installs")
        .select("state")
        .eq("project_id", projectId)
        .eq("plugin_id", "contact")
        .maybeSingle(),
    ]);

  const createdByIds = Array.from(
    new Set(((publishes ?? []) as Array<{ created_by?: string | null }>).map((row) => row.created_by).filter((id): id is string => Boolean(id))),
  );
  const { data: profiles } = createdByIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", createdByIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? null]));
  const publishRows = ((publishes ?? []) as Array<Record<string, unknown>>).map((row) => {
    const id = row.created_by as string | null | undefined;
    return {
      ...row,
      created_by_name: id ? profileMap.get(id) ?? null : null,
    };
  });

  const address = primaryAddress(
    readPublishConfig(),
    project.subdomain,
    project.primary_host,
  );
  const pageRows = pages ?? [];
  const homepage = pageRows.find((page) => page.is_homepage) ?? pageRows[0] ?? null;
  const settings = (project.settings ?? {}) as ProjectSettings;
  const contact = settings.contact ?? {};
  const detailsDone = Boolean(
    (contact.phone ?? "").trim() ||
      (contact.email ?? "").trim() ||
      (contact.address ?? "").trim() ||
      settings.logoData,
  );

  function blocksOf(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray((value as { blocks?: unknown[] }).blocks)) {
      return (value as { blocks: unknown[] }).blocks;
    }
    return [];
  }

  const homepageReady = homepage ? blocksOf(homepage.blocks).length > 0 : false;
  const sampleContentCount = pageRows.reduce(
    (total, page) => total + countSampleBlocks(page.blocks),
    0,
  );
  const contactEnabled = contactInstall?.state === "active";
  const hasContactForm = pageRows.some((page) =>
    blocksOf(page.blocks).some(
      (block) => (block as { type?: string } | null)?.type === "contact-form",
    ),
  );
  const hasLiveVersion = livePublish !== null;
  const siteState = siteStateOf({
    published: project.status === "published",
    hasLiveVersion,
    hasChanges: hasChanges === true,
    reviewState: project.review_state,
    suspendedAt: project.suspended_at,
  });

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: data.currentTeam.name, href: "/dashboard" },
          { label: project.name, href: `/dashboard/projects/${project.id}` },
          { label: "Version history" },
        ]}
        title="Version history"
        description="Switch back to an earlier version if something is not right. Your pages stay saved."
        actions={
          <Link
            href={`/dashboard/projects/${project.id}`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
            Back to overview
          </Link>
        }
      />

      <div className="mb-6">
        <PublishCard
          projectId={project.id}
          name={project.name}
          address={address}
          state={siteState}
          hasLiveVersion={hasLiveVersion}
          pagesCount={pageRows.length}
          homepageReady={homepageReady}
          detailsReady={detailsDone}
          contactFormPluginOff={!contactEnabled && hasContactForm}
          sampleContentCount={sampleContentCount}
          lastPublishedAt={livePublish?.live_at ?? livePublish?.created_at ?? null}
          showHistoryLink={false}
        />
      </div>

      <PublishHistory
        projectId={project.id}
        rows={(publishRows ?? []) as PublishHistoryRow[]}
        address={address}
      />
    </AppPage>
  );
}
