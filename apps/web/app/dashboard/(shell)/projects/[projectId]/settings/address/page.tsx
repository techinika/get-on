import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";
import { planLimits } from "@/lib/plans";
import { DOMAIN_COLUMNS, HOSTNAME_COLUMNS, asDomain, asHostname } from "@/lib/domains/rows";
import type { Domain, DomainHostname } from "@/lib/domains/types";
import { AddressManager } from "./address-manager";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let url = "";
  let published = false;
  let redirectFreeAddress = true;
  let domains: Domain[] = [];
  let hostnames: DomainHostname[] = [];

  if (current) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("subdomain, status, redirect_free_address")
      .eq("id", projectId)
      .eq("team_id", current.team.teamId)
      .maybeSingle();
    if (project?.subdomain) {
      url = siteAddress(readPublishConfig(), project.subdomain);
      published = project.status === "published";
      redirectFreeAddress = project.redirect_free_address !== false;
    }

    const { data: domainRows } = await supabase
      .from("domains")
      .select(DOMAIN_COLUMNS)
      .eq("project_id", projectId)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    domains = (domainRows ?? []).map(asDomain);

    const ids = domains.map((domain) => domain.id);
    if (ids.length > 0) {
      const { data: hostRows } = await supabase
        .from("domain_hostnames")
        .select(HOSTNAME_COLUMNS)
        .in("domain_id", ids)
        .neq("status", "removed")
        .order("created_at", { ascending: true });
      hostnames = (hostRows ?? []).map(asHostname);
    }
  }

  const plan = planLimits(current?.team.planId ?? "free");

  return (
    <div className="flex flex-col gap-6">
      <SettingsPageHeader
        title="Address"
        description="Your web address and sharing options."
        timing="right"
      />
      <AddressManager
        projectId={projectId}
        freeUrl={url}
        published={published}
        domains={domains}
        hostnames={hostnames}
        limit={plan.customDomainsPerSite}
        planName={plan.name}
        canManage={
          current?.team.role === "owner" || current?.team.role === "admin"
        }
        redirectFreeAddress={redirectFreeAddress}
      />
    </div>
  );
}
