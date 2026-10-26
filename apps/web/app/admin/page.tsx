import Link from "next/link";
import { ArrowRight, ExternalLink, ShieldAlert } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  adminSiteStatus,
  countReportsToday,
  loadAdminSites,
  type AdminSiteRow,
} from "@/lib/admin-data";
import { displayAddress } from "@/lib/publishing/status";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = createAdminClient();
  const sites = await loadAdminSites(admin);
  const config = readPublishConfig();

  const reportsToday = await countReportsToday(admin);

  const live = sites.filter((site) => adminSiteStatus(site) === "Live").length;
  const waiting = sites.filter((site) => site.reviewState === "pending").length;
  const attention = sites
    .filter(
      (site) =>
        site.suspendedAt ||
        site.reviewState === "pending" ||
        site.newReportCount > 0,
    )
    .sort((a, b) => attentionTime(b).localeCompare(attentionTime(a)));

  return (
    <AppPage width="default">
      <PageHeader
        title="Admin"
        description="A quick look at websites that need attention."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/email" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Email
            </Link>
            <Link href="/admin/domains" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Domains
            </Link>
            <Link href="/admin/ai" className={buttonVariants({ variant: "ghost", size: "md" })}>
              AI
            </Link>
            <Link href="/admin/billing" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Billing
            </Link>
            <Link href="/admin/sites" className={buttonVariants({ variant: "secondary", size: "md" })}>
              All websites
              <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-3">
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Live websites</p>
          <p className="text-stat-number mt-1 text-text">{live}</p>
        </AppCard>
        <Link href="/admin/sites?status=review" className="block">
          <AppCard className="p-5 transition-colors hover:bg-surface-muted">
            <p className="text-sm text-text-muted">Waiting for review</p>
            <p className="text-stat-number mt-1 text-text">{waiting}</p>
          </AppCard>
        </Link>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Reports today</p>
          <p className="text-stat-number mt-1 text-text">{reportsToday}</p>
        </AppCard>
      </div>

      <section className="mt-8">
        <h2 className="text-section-title text-text">Needs attention</h2>
        {attention.length === 0 ? (
          <AppCard className="mt-3 p-6">
            <p className="text-base text-text-muted">Nothing needs attention right now.</p>
          </AppCard>
        ) : (
          <div className="mt-3 overflow-hidden rounded-card border border-border bg-surface">
            <ul className="divide-y divide-border">
              {attention.map((site) => (
                <li
                  key={site.id}
                  className="flex flex-col gap-3 p-4 min-[768px]:flex-row min-[768px]:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/sites/${site.id}`}
                        className="break-all text-[15px] font-semibold text-primary hover:underline"
                      >
                        {displayAddress(siteAddress(config, site.subdomain))}
                      </Link>
                      <Badge variant={site.suspendedAt ? "danger" : "info"}>
                        {adminSiteStatus(site)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-text-muted">{site.ownerEmail}</p>
                    <p className="mt-1 text-sm text-text">{attentionReason(site)}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {relativeTime(attentionTime(site))}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/admin/sites/${site.id}`}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Open
                    </Link>
                    <a
                      href={siteAddress(config, site.subdomain)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open website"
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="mt-6 flex items-start gap-2 text-sm text-text-muted">
        <ShieldAlert size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
        Every action is written to the history and can be reviewed on the website page.
      </p>
    </AppPage>
  );
}

function attentionTime(site: AdminSiteRow): string {
  return site.suspendedAt ?? site.reviewRequestedAt ?? new Date().toISOString();
}

function attentionReason(site: AdminSiteRow): string {
  if (site.suspendedAt) return site.suspendedReason ?? "Suspended";
  if (site.reviewState === "pending") return "Waiting for review";
  if (site.newReportCount > 0) return "Reported";
  return "Needs attention";
}
