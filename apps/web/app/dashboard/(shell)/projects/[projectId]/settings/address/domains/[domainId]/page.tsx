import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";
import { DOMAIN_COLUMNS, HOSTNAME_COLUMNS, asDomain, asHostname } from "@/lib/domains/rows";
import type { Domain, DomainHostname } from "@/lib/domains/types";
import { DomainDetail } from "./domain-detail";

type Props = {
  params: Promise<{ projectId: string; domainId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export type DomainEventRow = {
  id: string;
  event: string;
  summary: string;
  created_at: string;
};

export default async function DomainDetailPage({ params, searchParams }: Props) {
  const { projectId, domainId } = await params;
  const { tab } = await searchParams;
  const current = await getCurrentTeam();
  if (!current) notFound();

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("subdomain, redirect_free_address")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!project) notFound();

  const { data: row } = await supabase
    .from("domains")
    .select(DOMAIN_COLUMNS)
    .eq("id", domainId)
    .eq("project_id", projectId)
    .neq("status", "removed")
    .maybeSingle();
  if (!row) notFound();

  const domain: Domain = asDomain(row);
  const { data: hostRows } = await supabase
    .from("domain_hostnames")
    .select(HOSTNAME_COLUMNS)
    .eq("domain_id", domain.id)
    .neq("status", "removed")
    .order("created_at", { ascending: true });
  const hosts: DomainHostname[] = (hostRows ?? []).map(asHostname);

  const { data: eventRows } = await supabase
    .from("domain_events")
    .select("id, event, summary, created_at")
    .eq("domain_id", domain.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const freeUrl = project.subdomain
    ? siteAddress(readPublishConfig(), project.subdomain)
    : "";

  const [{ data: projectRows }, { data: domainRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("team_id", current.team.teamId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("domains")
      .select("project_id, status")
      .eq("team_id", current.team.teamId)
      .neq("status", "removed"),
  ]);
  const limit = planLimits(current.team.planId).customDomainsPerSite;
  const counts = new Map<string, number>();
  for (const row of domainRows ?? []) {
    if (!row.project_id) continue;
    if (["draft", "removed", "failed", "plan_lapsed"].includes(String(row.status))) {
      continue;
    }
    const id = String(row.project_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const websites = (projectRows ?? [])
    .filter((row) => String(row.id) !== projectId)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      room: (counts.get(String(row.id)) ?? 0) < limit,
    }))
    .filter((row) => row.room);

  return (
    <DomainDetail
      projectId={projectId}
      domain={domain}
      hosts={hosts}
      events={(eventRows ?? []) as DomainEventRow[]}
      freeUrl={freeUrl}
      redirectFreeAddress={project.redirect_free_address !== false}
      websites={websites.map(({ id, name }) => ({ id, name }))}
      canManage={current.team.role === "owner" || current.team.role === "admin"}
      tab={tab === "settings" || tab === "activity" ? tab : "overview"}
    />
  );
}
