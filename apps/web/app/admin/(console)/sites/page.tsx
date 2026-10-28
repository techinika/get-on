import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { SitesTable, type SiteTableRow } from "@/components/admin/sites-table";
import { listProjects } from "@/lib/admin";
import type { AdminSiteRow } from "@/lib/admin/site-status";

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  review_state: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  team_id: string;
  team_name: string | null;
  owner_email: string | null;
  last_published_at: string | null;
  report_count: number;
  new_report_count: number;
};

export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const projects = (await listProjects(300)) as ProjectRow[];

  const filtered =
    params.status === "review"
      ? projects.filter((site) => site.review_state === "pending")
      : projects;

  const rows: SiteTableRow[] = filtered.map((site) => {
    const row: AdminSiteRow = {
      id: site.id,
      name: site.name,
      subdomain: site.subdomain,
      status: site.status,
      reviewState: site.review_state,
      suspendedAt: site.suspended_at,
      suspendedReason: site.suspended_reason,
      reviewRequestedAt: null,
      teamId: site.team_id,
      teamName: site.team_name ?? "Team",
      ownerEmail: site.owner_email ?? "No email",
      lastPublishedAt: site.last_published_at,
      reportCount: Number(site.report_count ?? 0),
      newReportCount: Number(site.new_report_count ?? 0),
    };
    return { ...row, address: `https://${site.subdomain}.get-on.tech` };
  });

  return (
    <AppPage width="wide">
      <PageHeader
        title="Websites"
        description={
          params.status === "review"
            ? "Websites waiting for a review."
            : "Metadata for every website. Page content is never shown here."
        }
      />
      <SitesTable rows={rows} />
    </AppPage>
  );
}
