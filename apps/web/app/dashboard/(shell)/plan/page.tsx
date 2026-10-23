import { Check, Info, Minus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { AppCard } from "@/components/app/card";
import { AppEmptyState } from "@/components/app/empty-state";
import { InfoBox } from "@/components/app/info-box";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PLAN_BADGE } from "@/components/shell/plan-badge";
import { getShellData } from "@/lib/dashboard";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
import { COMPARE_ROWS, PLAN_COPY } from "@/lib/plan-copy";
import { cn } from "@/lib/utils";

const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "enterprise"];

export default async function PlanPage() {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const plan = PLAN_BY_ID[data.currentTeam.planId] ?? PLAN_BY_ID.free;
  const copy = PLAN_COPY[plan.id];
  const badge = PLAN_BADGE[plan.id];

  const usage = [
    {
      label: "Websites",
      used: data.usage.websites,
      limit: plan.maxWebsites,
    },
    {
      label: "Team members",
      used: data.usage.members,
      limit: plan.maxMembers,
    },
    {
      label: "AI credits this month",
      used: plan.aiCreditsMonthly,
      limit: plan.aiCreditsMonthly,
    },
    {
      label: "Storage (MB)",
      used: 0,
      limit: plan.storageMb,
    },
  ];

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: data.currentTeam.name, href: "/dashboard" },
          { label: "Plan and billing" },
        ]}
        title="Plan and billing"
        description={`Your plan applies to everyone in ${data.currentTeam.name}.`}
      />

      <AppCard className="p-6">
        <div className="grid grid-cols-1 gap-6 min-[768px]:grid-cols-12">
          <div className="min-[768px]:col-span-7">
            <p className="text-label-caps">Your plan</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-heading text-[28px] font-bold leading-none text-text">
                {plan.name}
              </span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <p className="mt-3 text-base text-text-muted">{copy.priceLabel}</p>
            <p className="mt-1 text-[15px] text-text-muted">{copy.summary}</p>
          </div>

          <div className="min-[768px]:col-span-5">
            <ul className="flex flex-col gap-4">
              {usage.map((row) => {
                const percent =
                  row.limit === null || row.limit === 0
                    ? 0
                    : Math.min(100, (row.used / row.limit) * 100);
                return (
                  <li key={row.label}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-text">{row.label}</span>
                      <span className="text-sm text-text-muted">
                        {row.used} of {row.limit === null ? "unlimited" : row.limit}
                      </span>
                    </div>
                    {row.limit === null ? null : (
                      <Progress
                        className="mt-1.5"
                        value={percent}
                        warning={percent >= 80}
                        label={`${row.label} usage`}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </AppCard>

      <div className="mt-4">
        <InfoBox variant="info">
          <span className="font-semibold">Payments are coming soon.</span> When they are ready, you
          will be able to upgrade here in a few taps.
        </InfoBox>
      </div>

      <Section title="Compare plans" className="mt-8">
        <AppCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <caption className="sr-only">Compare Get-On plans</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-[200px] bg-surface px-4 py-4">
                  <span className="text-[15px] font-semibold text-text">What you get</span>
                </th>
                {PLAN_ORDER.map((id) => {
                  const current = id === plan.id;
                  return (
                    <th
                      key={id}
                      scope="col"
                      className={cn(
                        "w-40 px-4 py-4 align-top",
                        current && "bg-primary-soft",
                      )}
                    >
                      <span className="block text-card-title text-text">
                        {PLAN_BY_ID[id].name}
                      </span>
                      <span className="mt-0.5 block text-sm text-text-muted">
                        ${PLAN_BY_ID[id].priceUsdMonthly}
                        {PLAN_BY_ID[id].priceUsdMonthly > 0 ? " / month" : ""}
                      </span>
                      {current ? (
                        <Badge variant="primary" className="mt-2">
                          Current plan
                        </Badge>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-4 py-3 text-left text-[15px] font-medium text-text"
                  >
                    {row.label}
                  </th>
                  {PLAN_ORDER.map((id) => {
                    const value = row.values[id];
                    return (
                      <td
                        key={id}
                        className={cn(
                          "px-4 py-3 text-center text-[15px] text-text",
                          id === plan.id && "bg-primary-soft",
                        )}
                      >
                        {value === true ? (
                          <Check
                            size={18}
                            strokeWidth={2}
                            aria-label="Yes"
                            className="mx-auto text-success"
                          />
                        ) : value === false ? (
                          <Minus
                            size={18}
                            strokeWidth={2}
                            aria-label="No"
                            className="mx-auto text-text-muted"
                          />
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-border">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-5" />
                {PLAN_ORDER.map((id) => {
                  const current = id === plan.id;
                  const isEnterprise = id === "enterprise";
                  return (
                    <td
                      key={id}
                      className={cn("px-4 py-5 text-center", id === plan.id && "bg-primary-soft")}
                    >
                      {current ? (
                        <span className="text-sm text-text-muted">Your plan</span>
                      ) : isEnterprise ? (
                        <Link
                          href="/request-demo?interest=enterprise"
                          className={buttonVariants({ variant: "primary", size: "md" })}
                        >
                          Talk to us
                        </Link>
                      ) : (
                        <span
                          title="Payments are coming soon"
                          aria-disabled="true"
                          className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text opacity-60"
                        >
                          Upgrade
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </AppCard>
      </Section>

      <Section title="Billing history" className="mt-8">
        <AppEmptyState
          compact
          icon={<Info size={40} strokeWidth={1.75} aria-hidden />}
          title="No invoices yet"
          description="Your receipts will show up here once payments start."
        />
      </Section>
    </AppPage>
  );
}
