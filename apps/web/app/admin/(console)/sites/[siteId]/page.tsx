import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  FlagList,
  ReportList,
  SiteActions,
} from "@/components/admin/site-actions";
import { getAdminSite } from "@/lib/admin";
import { canStaff, requireStaff } from "@/lib/admin/staff";
import { adminSiteStatus } from "@/lib/admin/site-status";
import { adminSiteAddress, displayHostname } from "@/lib/admin/site-address";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  Live: "live",
  "Not published": "neutral",
  "Under review": "info",
  Suspended: "danger",
} as const;

export default async function AdminSitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const staff = await requireStaff();
  const site = await getAdminSite(siteId);
  if (!site) notFound();

  const { reports, flags, audit } = site;
  const address = adminSiteAddress(site.subdomain);
  const status = adminSiteStatus({
    status: site.status,
    reviewState: site.review_state,
    suspendedAt: site.suspended_at,
  });

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Websites", href: "/admin/sites" },
          { label: displayHostname(address) },
        ]}
        title={displayHostname(address)}
        description={`${site.name} · ${site.owner_email ?? "No email"}`}
        actions={
          <Link href="/admin/sites" className={buttonVariants({ variant: "secondary", size: "md" })}>
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
            All websites
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <AppCard className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={STATUS_VARIANT[status]} dot={status === "Live"}>
              {status}
            </Badge>
            <a
              href={address}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Visit website
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
            </a>
            {site.publishes[0]?.live_at ? (
              <span className="text-sm text-text-muted">
                Last published {relativeTime(site.publishes[0].live_at)}
              </span>
            ) : null}
          </div>

          {site.suspended_reason ? (
            <div className="mt-4 rounded-info bg-danger-soft p-3.5 text-sm text-danger-text">
              <strong className="font-semibold">Offline reason:</strong> {site.suspended_reason}
            </div>
          ) : null}

          <div className="mt-4">
            <SiteActions
              siteId={site.id}
              address={address}
              suspended={Boolean(site.suspended_at)}
              reviewPending={site.review_state === "pending"}
              canTakeDownDirect={canStaff(staff.role, "website.takedown.direct")}
              canTakeDownRequest={canStaff(staff.role, "website.takedown.request")}
              canReinstateDirect={canStaff(staff.role, "website.reinstate.direct")}
              canReinstateRequest={canStaff(staff.role, "website.reinstate.request")}
            />
          </div>
        </AppCard>

        <section>
          <h2 className="text-section-title text-text">Publishing history</h2>
          <AppCard className="mt-3 px-5">
            {site.publishes.length === 0 ? (
              <p className="py-4 text-sm text-text-muted">This website has not been published yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {site.publishes.map((publish) => (
                  <li key={publish.id} className="flex flex-wrap items-center gap-2 py-3">
                    <span className="text-[15px] font-semibold text-text">
                      {relativeTime(publish.live_at ?? publish.created_at)}
                    </span>
                    <Badge variant={publish.status === "live" ? "live" : publish.status === "failed" ? "danger" : "neutral"}>
                      {publish.status === "live"
                        ? "Live"
                        : publish.status === "failed"
                          ? "Did not finish"
                          : publish.status === "offline"
                            ? "Offline"
                            : publish.status === "superseded"
                              ? "Earlier"
                              : publish.status}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {publish.pages_count ?? 0} page{publish.pages_count === 1 ? "" : "s"} ·{" "}
                      {publish.error_code ? `${publish.error_code} · ` : ""}
                      {publish.id.slice(0, 8)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        </section>

        <section>
          <h2 className="text-section-title text-text">Reports</h2>
          <AppCard className="mt-3 p-5">
            <ReportList siteId={site.id} reports={reports} />
          </AppCard>
        </section>

        <section>
          <h2 className="text-section-title text-text">Flags</h2>
          <AppCard className="mt-3 p-5">
            <FlagList flags={flags} />
          </AppCard>
        </section>

        <section>
          <h2 className="text-section-title text-text">History</h2>
          <AppCard className="mt-3 px-5">
            {audit.length === 0 ? (
              <p className="py-4 text-sm text-text-muted">No admin actions yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2 py-3">
                    <span className="text-[15px] font-semibold capitalize text-text">
                      {entry.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-text-muted">{entry.staff_name}</span>
                    <span className="text-xs text-text-muted">
                      {relativeTime(entry.created_at)}
                    </span>
                    {entry.reason ? (
                      <span className="w-full text-sm text-text-muted">{entry.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        </section>
      </div>
    </AppPage>
  );
}
