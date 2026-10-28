import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getDashboard } from "@/lib/admin";

export const dynamic = "force-dynamic";

type Dashboard = Record<string, number | boolean>;

function count(data: Dashboard, key: string): number {
  const value = data[key];
  return typeof value === "number" ? value : 0;
}

export default async function AdminOverviewPage() {
  const data = (await getDashboard()) as Dashboard;
  const cards = [
    { label: "Teams", value: count(data, "teams"), href: "/admin/teams" },
    { label: "Websites", value: count(data, "websites"), href: "/admin/sites" },
    { label: "Published websites", value: count(data, "published") },
    { label: "Paid teams", value: count(data, "paid_teams") },
    { label: "Open support cases", value: count(data, "open_cases") },
    { label: "Cases past their due time", value: count(data, "cases_late") },
    { label: "Approvals waiting", value: count(data, "pending_approvals") },
    { label: "Abuse reports waiting", value: count(data, "abuse_pending") },
    { label: "Email failures (24 h)", value: count(data, "email_failed_24h") },
  ];

  return (
    <AppPage width="default">
      <PageHeader
        title="Overview"
        description="A quick look at the platform. Customer content stays out of this console."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/teams" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Teams
            </Link>
            <Link href="/admin/sites" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Websites
            </Link>
            <Link href="/admin/email" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Email
            </Link>
            <Link
              href="/admin/operations"
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              Operations
            </Link>
            <Link
              href="/admin/teams"
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              Search accounts
              <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
        {cards.map((card) =>
          card.href ? (
            <Link key={card.label} href={card.href} className="block">
              <AppCard className="h-full p-5 transition-colors hover:bg-surface-muted">
                <p className="text-sm text-text-muted">{card.label}</p>
                <p className="text-stat-number mt-1 text-text">{card.value}</p>
              </AppCard>
            </Link>
          ) : (
            <AppCard key={card.label} className="p-5">
              <p className="text-sm text-text-muted">{card.label}</p>
              <p className="text-stat-number mt-1 text-text">{card.value}</p>
            </AppCard>
          ),
        )}
      </div>

      {data.marketing_paused ? (
        <AppCard className="mt-6 border-warning-border p-5">
          <p className="text-sm font-semibold text-warning-text">Marketing email is paused.</p>
          <p className="mt-1 text-sm text-text-muted">
            Campaigns stay queued until a super admin turns marketing back on.
          </p>
        </AppCard>
      ) : null}

      <p className="mt-6 flex items-start gap-2 text-sm text-text-muted">
        <ShieldAlert size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
        Opening customer metadata needs a purpose. Every action is written to the staff audit log.
      </p>
    </AppPage>
  );
}
