import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { SitesTable, type SiteTableRow } from "@/components/admin/sites-table";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminSites } from "@/lib/admin-data";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";

export const dynamic = "force-dynamic";

export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();
  const sites = await loadAdminSites(admin);
  const config = readPublishConfig();

  const filtered =
    params.status === "review"
      ? sites.filter((site) => site.reviewState === "pending")
      : sites;

  const rows: SiteTableRow[] = filtered.map((site) => ({
    ...site,
    address: siteAddress(config, site.subdomain),
  }));

  return (
    <AppPage width="wide">
      <PageHeader
        title="Websites"
        description={
          params.status === "review"
            ? "Websites waiting for a review."
            : "Every website on Get-On."
        }
      />
      <SitesTable rows={rows} />
    </AppPage>
  );
}
