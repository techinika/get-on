import type { createAdminClient } from "@/lib/supabase/admin";
import { DOMAIN_COLUMNS, HOSTNAME_COLUMNS, asDomain, asHostname } from "@/lib/domains/rows";
import type { Domain, DomainHostname } from "@/lib/domains/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AdminDomainRow = {
  domain: Domain;
  hostnames: DomainHostname[];
  teamName: string;
  ownerEmail: string;
  projectName: string | null;
  projectSubdomain: string | null;
};

export type AdminDomainEvent = {
  id: string;
  hostname_id: string | null;
  event: string;
  summary: string;
  created_at: string;
};

async function ownersByTeam(admin: AdminClient, teamIds: string[]) {
  const { data: teams } = teamIds.length
    ? await admin.from("teams").select("id, name, owner_id").in("id", teamIds)
    : { data: [] as Array<{ id: string; name: string; owner_id: string }> };
  const ownerIds = [...new Set((teams ?? []).map((team) => team.owner_id))];
  const { data: profiles } = ownerIds.length
    ? await admin.from("profiles").select("id, email").in("id", ownerIds)
    : { data: [] as Array<{ id: string; email: string | null }> };
  const emailById = new Map((profiles ?? []).map((profile) => [profile.id, profile.email ?? ""]));
  return new Map(
    (teams ?? []).map((team) => [
      team.id,
      { name: team.name, email: emailById.get(team.owner_id) ?? "" },
    ]),
  );
}

export async function loadAdminDomains(admin: AdminClient): Promise<AdminDomainRow[]> {
  const [{ data: domainRows }, { data: hostRows }, { data: projectRows }] = await Promise.all([
    admin
      .from("domains")
      .select(DOMAIN_COLUMNS)
      .neq("status", "removed")
      .order("created_at", { ascending: false }),
    admin
      .from("domain_hostnames")
      .select(HOSTNAME_COLUMNS)
      .neq("status", "removed")
      .order("created_at", { ascending: true }),
    admin.from("projects").select("id, name, subdomain"),
  ]);

  const domains = (domainRows ?? []).map(asDomain);
  const hostnames = (hostRows ?? []).map(asHostname);
  const projects = new Map((projectRows ?? []).map((project) => [String(project.id), project]));
  const owners = await ownersByTeam(
    admin,
    [...new Set(domains.map((domain) => domain.teamId))],
  );

  return domains.map((domain) => {
    const project = domain.projectId ? projects.get(domain.projectId) : null;
    const team = owners.get(domain.teamId);
    return {
      domain,
      hostnames: hostnames.filter((host) => host.domainId === domain.id),
      teamName: team?.name ?? "Team",
      ownerEmail: team?.email ?? "",
      projectName: project ? String(project.name) : null,
      projectSubdomain: project ? String(project.subdomain) : null,
    };
  });
}

export async function loadAdminDomain(
  admin: AdminClient,
  domainId: string,
): Promise<{ row: AdminDomainRow; events: AdminDomainEvent[] } | null> {
  const rows = await loadAdminDomains(admin);
  const row = rows.find((item) => item.domain.id === domainId);
  if (!row) return null;

  const { data: events } = await admin
    .from("domain_events")
    .select("id, hostname_id, event, summary, created_at")
    .eq("domain_id", domainId)
    .order("created_at", { ascending: false })
    .limit(200);

  return { row, events: (events ?? []) as AdminDomainEvent[] };
}

export function domainMatches(row: AdminDomainRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    row.domain.registrable,
    row.domain.displayName,
    row.teamName,
    row.ownerEmail,
    row.projectName ?? "",
    row.projectSubdomain ?? "",
    ...row.hostnames.map((host) => host.hostname),
  ].some((value) => value.toLowerCase().includes(q));
}
