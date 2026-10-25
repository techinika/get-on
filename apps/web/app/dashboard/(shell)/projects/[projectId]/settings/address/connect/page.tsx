import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";
import { DOMAIN_COLUMNS, HOSTNAME_COLUMNS, asDomain, asHostname } from "@/lib/domains/rows";
import { DohResolver } from "@/lib/domains/dns";
import { checkCaaRecords, type CaaCheck } from "@/lib/domains/diagnostics";
import type { Domain, DomainHostname } from "@/lib/domains/types";
import { ConnectWizard } from "./connect-wizard";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ domain?: string }>;
};

export default async function ConnectPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { domain: domainId } = await searchParams;
  const current = await getCurrentTeam();
  let freeUrl = "";
  let published = false;
  let domain: Domain | null = null;
  let hosts: DomainHostname[] = [];
  let caa: CaaCheck | null = null;
  let autoPublish: "published" | "failed" | null = null;

  if (current) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("subdomain, status")
      .eq("id", projectId)
      .eq("team_id", current.team.teamId)
      .maybeSingle();
    if (project?.subdomain) {
      freeUrl = siteAddress(readPublishConfig(), project.subdomain);
      published = project.status === "published";
    }

    if (domainId) {
      const { data } = await supabase
        .from("domains")
        .select(DOMAIN_COLUMNS)
        .eq("id", domainId)
        .eq("project_id", projectId)
        .neq("status", "removed")
        .maybeSingle();
      if (data) domain = asDomain(data);
    }

    if (domain) {
      const { data: hostRows } = await supabase
        .from("domain_hostnames")
        .select(HOSTNAME_COLUMNS)
        .eq("domain_id", domain.id)
        .neq("status", "removed")
        .order("created_at", { ascending: true });
      hosts = (hostRows ?? []).map(asHostname);
      const mainHost = hosts.find((host) => host.role === "main") ?? hosts[0];
      caa = await checkCaaRecords(
        new DohResolver(),
        mainHost?.hostname ?? domain.registrable,
        domain.registrable,
      ).catch(() => null);

      const { data: event } = await supabase
        .from("domain_events")
        .select("event, created_at")
        .eq("domain_id", domain.id)
        .in("event", ["auto_published", "auto_publish_failed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        event &&
        (!mainHost?.liveAt || String(event.created_at) >= mainHost.liveAt)
      ) {
        autoPublish =
          event.event === "auto_published" ? "published" : "failed";
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] pb-28 md:pb-0">
      <Link
        href={`/dashboard/projects/${projectId}/settings/address`}
        className="inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Address
      </Link>
      <ConnectWizard
        projectId={projectId}
        initialDomain={domain}
        initialHosts={hosts}
        caa={caa}
        autoPublish={autoPublish}
        freeUrl={freeUrl}
        published={published}
      />
    </div>
  );
}
