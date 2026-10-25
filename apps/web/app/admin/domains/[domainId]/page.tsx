import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { CopyValue } from "@/components/app/copy-value";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminDomain } from "@/lib/admin-domains";
import { recordFullName, relativeName, verificationRecord } from "@/lib/domains/records";
import { DomainStatusBadge, HostnameStatusBadge } from "@/app/dashboard/(shell)/projects/[projectId]/settings/address/address-status";
import { AdminDomainActions } from "./admin-domain-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ domainId: string }> };

function date(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

export default async function AdminDomainPage({ params }: Props) {
  const { domainId } = await params;
  const admin = createAdminClient();
  const result = await loadAdminDomain(admin, domainId);
  if (!result) notFound();

  const { row, events } = result;
  const { domain, hostnames } = row;
  const txt = verificationRecord(domain.registrable, domain.verificationValue);

  const [{ data: projectRows }, { data: teamRows }] = await Promise.all([
    admin
      .from("projects")
      .select("id, name, team_id")
      .is("deleted_at", null)
      .neq("team_id", domain.teamId)
      .order("name", { ascending: true })
      .limit(500),
    admin.from("teams").select("id, name"),
  ]);
  const teamNames = new Map(
    (teamRows ?? []).map((team) => [String(team.id), String(team.name)]),
  );
  const targets = (projectRows ?? []).map((project) => ({
    id: String(project.id),
    name: String(project.name),
    teamName: teamNames.get(String(project.team_id)) ?? "Team",
  }));

  return (
    <AppPage width="default">
      <PageHeader
        title={domain.displayName}
        description={`${row.teamName} · ${row.ownerEmail || "No owner email"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/domains" className={buttonVariants({ variant: "ghost", size: "md" })}>
              All domains
            </Link>
            {domain.projectId ? (
              <Link href={`/admin/sites/${domain.projectId}`} className={buttonVariants({ variant: "secondary", size: "md" })}>
                Website
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <DomainStatusBadge status={domain.status} />
        <Badge variant={domain.reviewState === "pending" ? "draft" : "neutral"}>
          Review: {domain.reviewState}
        </Badge>
        <Badge variant={domain.role === "primary" ? "primary" : "neutral"}>{domain.role}</Badge>
      </div>

      <AdminDomainActions
        domainId={domain.id}
        reviewState={domain.reviewState}
        status={domain.status}
        canSimulate={
          process.env.NODE_ENV !== "production" ||
          process.env.DOMAINS_ALLOW_SIMULATION === "true"
        }
        hostnames={hostnames.map((host) => ({
          id: host.id,
          hostname: host.hostname,
          providerId: host.providerId,
        }))}
        targets={targets}
      />

      <div className="mt-5 grid gap-5">
        <AppCard className="p-5">
          <h2 className="text-[17px] font-semibold text-text">Hostnames</h2>
          <ul className="mt-3 grid gap-3">
            {hostnames.map((host) => (
              <li key={host.id} className="rounded-card border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all font-mono text-[15px] font-semibold text-text">{host.hostname}</code>
                  <HostnameStatusBadge status={host.status} />
                  <Badge variant={host.role === "main" ? "primary" : "neutral"}>{host.role}</Badge>
                  <Badge>{host.mode}</Badge>
                </div>
                <dl className="mt-3 grid gap-1 text-sm">
                  <div className="flex flex-wrap gap-2"><dt className="text-text-muted">Provider status</dt><dd className="text-text">{host.providerStatus ?? "—"}</dd></div>
                  <div className="flex flex-wrap gap-2"><dt className="text-text-muted">SSL</dt><dd className="text-text">{host.sslStatus ?? "—"}</dd></div>
                  <div className="flex flex-wrap gap-2"><dt className="text-text-muted">Provider id</dt><dd className="break-all text-text">{host.providerId ?? "—"}</dd></div>
                  <div className="flex flex-wrap gap-2"><dt className="text-text-muted">CNAME</dt><dd className="text-text">{host.cnameTarget || "—"}</dd></div>
                  <div className="flex flex-wrap gap-2"><dt className="text-text-muted">Last checked</dt><dd className="text-text">{date(host.cnameCheckedAt)}</dd></div>
                </dl>
                {host.verificationErrors.length > 0 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-text">Technical details</summary>
                    <ul className="mt-2 grid gap-1">
                      {host.verificationErrors.map((error) => (
                        <li key={error}><CopyValue value={error} label="error" /></li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </AppCard>

        <AppCard className="p-5">
          <h2 className="text-[17px] font-semibold text-text">Verification</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">TXT name</dt><dd><CopyValue value={txt.name} label="TXT name" /></dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">TXT value</dt><dd><CopyValue value={txt.value} label="TXT value" /></dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">Full name</dt><dd><CopyValue value={recordFullName(txt, domain.registrable)} label="full name" /></dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">Started</dt><dd className="text-text">{date(domain.verificationStartedAt)}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">Expires</dt><dd className="text-text">{date(domain.verificationExpiresAt)}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">Verified</dt><dd className="text-text">{date(domain.verifiedAt)}</dd></div>
          </dl>
        </AppCard>

        <AppCard className="p-5">
          <h2 className="text-[17px] font-semibold text-text">Records</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {hostnames.map((host) => (
              <li key={host.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-text-muted">CNAME {relativeName(host.hostname, domain.registrable)}</span>
                <CopyValue value={host.cnameTarget} label="CNAME value" />
              </li>
            ))}
          </ul>
        </AppCard>

        <AppCard className="p-5">
          <h2 className="text-[17px] font-semibold text-text">Events</h2>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No events yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-sm text-text">{event.summary}</span>
                  <span className="text-xs text-text-muted">{date(event.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      </div>
    </AppPage>
  );
}
