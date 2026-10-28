import { asDomain, asHostname } from "@/lib/domains/rows";
import type { Domain, DomainHostname } from "@/lib/domains/types";
import {
  getAdminDomain,
  getAdminDomains,
  type AdminDomainEvent,
  type AdminDomainTarget,
} from "./screens";

export type AdminDomainRow = {
  domain: Domain;
  hostnames: DomainHostname[];
  teamName: string;
  ownerEmail: string;
  projectName: string | null;
  projectSubdomain: string | null;
};

function rows(
  domains: Record<string, unknown>[],
  hostnames: Record<string, unknown>[],
): AdminDomainRow[] {
  const hosts = hostnames.map(asHostname);
  return domains.map((row) => {
    const domain = asDomain(row);
    return {
      domain,
      hostnames: hosts.filter((host) => host.domainId === domain.id),
      teamName: String(row.team_name ?? "Team"),
      ownerEmail: String(row.owner_email ?? ""),
      projectName: row.project_name ? String(row.project_name) : null,
      projectSubdomain: row.project_subdomain ? String(row.project_subdomain) : null,
    };
  });
}

export async function loadAdminDomains(): Promise<AdminDomainRow[]> {
  const result = await getAdminDomains();
  return rows(result.domains, result.hostnames);
}

export async function loadAdminDomain(
  domainId: string,
): Promise<{
  row: AdminDomainRow;
  events: AdminDomainEvent[];
  targets: AdminDomainTarget[];
} | null> {
  const result = await getAdminDomain(domainId);
  if (!result) return null;
  const [row] = rows([result.domain], result.hostnames);
  return {
    row,
    events: result.events,
    targets: result.targets,
  };
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
