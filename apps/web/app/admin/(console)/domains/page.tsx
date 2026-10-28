import Link from "next/link";
import { Search } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { domainMatches, loadAdminDomains } from "@/lib/admin/domain-rows";
import { DomainStatusBadge, HostnameStatusBadge } from "@/app/dashboard/(shell)/projects/[projectId]/settings/address/address-status";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function AdminDomainsPage({ searchParams }: Props) {
  const { q = "", status = "all" } = await searchParams;
  const rows = (await loadAdminDomains()).filter((row) => domainMatches(row, q));

  const visible = rows.filter((row) => {
    if (status === "live") return row.domain.status === "live";
    if (status === "attention") {
      return ["attention", "stalled", "failed", "plan_lapsed"].includes(row.domain.status);
    }
    if (status === "review") return row.domain.reviewState === "pending";
    return true;
  });

  return (
    <AppPage width="wide">
      <PageHeader
        title="Domains"
        description="Every customer domain, its addresses and current state."
        actions={<Link href="/admin"><Button type="button" variant="ghost">Back to admin</Button></Link>}
      />

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search domain, address, owner or website"
            className="pl-9"
            aria-label="Search domains"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="h-11 rounded-input border border-border bg-surface px-3 text-sm text-text"
          aria-label="Status"
        >
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="attention">Needs attention</option>
          <option value="review">Waiting for review</option>
        </select>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {visible.length === 0 ? (
        <AppCard className="p-6">
          <p className="text-base text-text-muted">No domains match.</p>
        </AppCard>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Hostnames</th>
                <th className="px-4 py-3">Website</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.domain.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/domains/${row.domain.id}`} className="break-all text-[15px] font-semibold text-primary hover:underline">
                      {row.domain.displayName}
                    </Link>
                    {row.domain.reviewState === "pending" ? (
                      <div className="mt-1"><Badge variant="draft">Review</Badge></div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="grid gap-1">
                      {row.hostnames.map((host) => (
                        <li key={host.id} className="flex flex-wrap items-center gap-1">
                          <code className="break-all font-mono text-xs text-text">{host.hostname}</code>
                          <HostnameStatusBadge status={host.status} />
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.projectName ? (
                      <Link href={`/admin/sites/${row.domain.projectId}`} className="text-primary hover:underline">{row.projectName}</Link>
                    ) : <span className="text-text-muted">Not used</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <p className="text-text">{row.teamName}</p>
                    <p className="text-text-muted">{row.ownerEmail}</p>
                  </td>
                  <td className="px-4 py-3"><DomainStatusBadge status={row.domain.status} /></td>
                  <td className="max-w-[220px] px-4 py-3 text-sm text-text-muted">{row.domain.statusReason ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {row.domain.verifiedAt ? new Date(row.domain.verifiedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {row.domain.registrar.expiresAt ? new Date(row.domain.registrar.expiresAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/domains/${row.domain.id}`} className="text-sm font-semibold text-primary hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppPage>
  );
}
