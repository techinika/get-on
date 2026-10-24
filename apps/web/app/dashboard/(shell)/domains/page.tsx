import Link from "next/link";
import { Globe2 } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";
import { DOMAIN_COLUMNS, HOSTNAME_COLUMNS, asDomain, asHostname } from "@/lib/domains/rows";
import type { Domain, DomainHostname } from "@/lib/domains/types";
import { DomainStatusBadge } from "../projects/[projectId]/settings/address/address-status";
import { ConnectDomainButton } from "./connect-domain-button";

type Props = { searchParams: Promise<{ filter?: string }> };
type Filter = "all" | "live" | "attention" | "waiting";

function filterOf(value: string | undefined): Filter {
  return value === "live" || value === "attention" || value === "waiting" ? value : "all";
}

function inFilter(domain: Domain, filter: Filter): boolean {
  if (filter === "live") return domain.status === "live";
  if (filter === "attention") return ["attention", "stalled", "failed", "plan_lapsed"].includes(domain.status);
  if (filter === "waiting") return ["draft", "awaiting_txt", "verified", "connecting"].includes(domain.status);
  return true;
}

function expiry(value: string | undefined): { label: string; variant: "neutral" | "draft" | "danger" } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const label = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  if (days <= 7) return { label, variant: "danger" };
  if (days <= 30) return { label, variant: "draft" };
  return { label, variant: "neutral" };
}

export default async function DomainsPage({ searchParams }: Props) {
  const { filter: rawFilter } = await searchParams;
  const filter = filterOf(rawFilter);
  const current = await getCurrentTeam();
  let domains: Domain[] = [];
  let hosts: DomainHostname[] = [];
  let websites: { id: string; name: string; address: string }[] = [];

  if (current) {
    const supabase = await createClient();
    const [{ data: domainRows }, { data: projectRows }] = await Promise.all([
      supabase
        .from("domains")
        .select(DOMAIN_COLUMNS)
        .eq("team_id", current.team.teamId)
        .neq("status", "removed")
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name, subdomain")
        .eq("team_id", current.team.teamId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);
    domains = (domainRows ?? []).map(asDomain);
    websites = (projectRows ?? []).map((project) => ({
      id: String(project.id),
      name: String(project.name),
      address: siteAddress(readPublishConfig(), String(project.subdomain)),
    }));

    const ids = domains.map((domain) => domain.id);
    if (ids.length > 0) {
      const { data: hostRows } = await supabase
        .from("domain_hostnames")
        .select(HOSTNAME_COLUMNS)
        .in("domain_id", ids)
        .neq("status", "removed")
        .order("created_at", { ascending: true });
      hosts = (hostRows ?? []).map(asHostname);
    }
  }

  const projects = new Map(websites.map((website) => [website.id, website]));
  const visible = domains.filter((domain) => inFilter(domain, filter));

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "attention", label: "Needs attention" },
    { id: "waiting", label: "Waiting" },
  ];

  return (
    <AppPage width="wide">
      <PageHeader
        title="Domains"
        description={`Domains connected to your websites in ${current?.team.teamName ?? "your team"}.`}
        actions={websites.length > 0 ? <ConnectDomainButton websites={websites} /> : null}
      />

      {websites.length === 0 ? (
        <AppCard className="border-2 border-dashed border-border-strong p-8 text-center">
          <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent-soft text-accent-text">
            <Globe2 className="h-9 w-9" aria-hidden />
          </span>
          <h2 className="mt-4 text-[17px] font-semibold text-text">Create a website first</h2>
          <p className="mt-1 text-[15px] text-text-muted">You need a website before you can connect a domain.</p>
          <Link href="/dashboard/new"><Button type="button" className="mt-4">Create a website</Button></Link>
        </AppCard>
      ) : domains.length === 0 ? (
        <AppCard className="border-2 border-dashed border-border-strong p-8 text-center">
          <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent-soft text-accent-text">
            <Globe2 className="h-9 w-9" aria-hidden />
          </span>
          <h2 className="mt-4 text-[17px] font-semibold text-text">No domains yet</h2>
          <p className="mt-1 text-[15px] text-text-muted">Connect your own domain to a website to see it here.</p>
          <div className="mt-4 flex justify-center"><ConnectDomainButton websites={websites} /></div>
        </AppCard>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((item) => (
              <Link
                key={item.id}
                href={item.id === "all" ? "/dashboard/domains" : `/dashboard/domains?filter=${item.id}`}
                className={`inline-flex h-9 items-center rounded-pill px-3.5 text-sm font-semibold ${
                  filter === item.id ? "bg-primary-soft text-primary" : "bg-surface-muted text-text-muted hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-card border border-border bg-surface min-[900px]:block">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Addresses</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((domain) => {
                  const domainHosts = hosts.filter((host) => host.domainId === domain.id);
                  const main = domainHosts.find((host) => host.role === "main");
                  const project = domain.projectId ? projects.get(domain.projectId) : null;
                  const expiryInfo = expiry(domain.registrar.expiresAt);
                  return (
                    <tr key={domain.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <Link
                          href={project ? `/dashboard/projects/${project.id}/settings/address/domains/${domain.id}` : "/dashboard/domains"}
                          className="break-all text-[15px] font-semibold text-text hover:text-primary"
                        >
                          {domain.displayName}
                        </Link>
                        <div className="mt-1"><Badge variant={domain.role === "primary" ? "primary" : "neutral"}>{domain.role === "primary" ? "Main domain" : "Also redirects"}</Badge></div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {project ? (
                          <Link href={`/dashboard/projects/${project.id}`} className="text-primary hover:underline">{project.name}</Link>
                        ) : "Not used"}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        <p>{domainHosts.length} address{domainHosts.length === 1 ? "" : "es"}</p>
                        {main ? <p className="break-all text-text">{main.hostname}</p> : null}
                      </td>
                      <td className="px-4 py-3"><DomainStatusBadge status={domain.status} /></td>
                      <td className="px-4 py-3">
                        {expiryInfo ? <Badge variant={expiryInfo.variant}>{expiryInfo.label}</Badge> : <span className="text-sm text-text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {project ? (
                          <Link href={`/dashboard/projects/${project.id}/settings/address/domains/${domain.id}`} className="text-sm font-semibold text-primary hover:underline">Manage</Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 min-[900px]:hidden">
            {visible.map((domain) => {
              const domainHosts = hosts.filter((host) => host.domainId === domain.id);
              const project = domain.projectId ? projects.get(domain.projectId) : null;
              return (
                <AppCard key={domain.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={project ? `/dashboard/projects/${project.id}/settings/address/domains/${domain.id}` : "/dashboard/domains"}
                      className="break-all text-[17px] font-semibold text-text hover:text-primary"
                    >
                      {domain.displayName}
                    </Link>
                    <DomainStatusBadge status={domain.status} />
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    {project ? project.name : "Not used"} · {domainHosts.length} address{domainHosts.length === 1 ? "" : "es"}
                  </p>
                  {project ? (
                    <Link href={`/dashboard/projects/${project.id}/settings/address/domains/${domain.id}`} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
                      Manage
                    </Link>
                  ) : null}
                </AppCard>
              );
            })}
          </div>
        </>
      )}
    </AppPage>
  );
}
