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

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const params = await searchParams;
  const upgrade = params.upgrade as PlanId | undefined;
  const upgradePlan = upgrade && PLAN_BY_ID[upgrade] ? PLAN_BY_ID[upgrade] : null;

  const plan = PLAN_BY_ID[data.currentTeam.planId] ?? PLAN_BY_ID.free;
  const copy = PLAN_COPY[plan.id];
  const badge = PLAN_BADGE[plan.id];

  const storageBytes = data.usage.storageBytes ?? 0;
  const storageMbUsed = Math.max(0, Math.round((storageBytes / (1024 * 1024)) * 10) / 10);
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
      label: "AI credits left",
      used: data.usage.aiCredits ?? 0,
      limit: null,
    },
    {
      label: "Storage (MB)",
      used: storageMbUsed,
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

      {upgradePlan ? (
        <InfoBox className="mb-6">
          <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            <div>
              <p className="text-base font-semibold text-text">
                Subscribe to {upgradePlan.name}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Subscription checkout is not set up yet. To continue, choose a plan or contact us — we&apos;ll guide you through the next steps.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {upgradePlan.id === "enterprise" ? (
                <Link href="/request-demo?interest=enterprise" className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
                  Request a demo
                </Link>
              ) : (
                <Link href="/request-demo?interest=upgrade" className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
                  Request to subscribe
                </Link>
              )}
              <Link href="/dashboard/plan" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
                View plans
              </Link>
            </div>
          </div>
        </InfoBox>
      ) : null}

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
              {usage.map((item) => {
                const limit = item.limit ?? 0;
                return (
                  <li key={item.label} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text">{item.label}</span>
                      <span className="text-text-muted">
                        {item.label === "Storage (MB)"
                          ? `${item.used} MB / ${limit === 0 ? "—" : `${limit} MB`}`
                          : item.label === "AI credits left"
                            ? `${item.used}`
                            : `${item.used} / ${limit === 0 ? "—" : limit}`}
                      </span>
                    </div>
                    {limit > 0 ? (
                      <Progress
                        value={Math.min(
                          100,
                          Math.round(
                            item.label === "Storage (MB)"
                              ? (storageBytes / (limit * 1024 * 1024)) * 100
                              : (item.used / limit) * 100,
                          ),
                        )}
                        label={`${item.label} used`}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </AppCard>

      <Section
        title="Compare plans"
        description="Change your plan at any time from your team settings."
      >
        <AppCard className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left text-label-caps text-text-muted">Feature</th>
                {PLAN_ORDER.map((planId) => {
                  const planDef = PLAN_BY_ID[planId];
                  const planBadge = PLAN_BADGE[planId];
                  return (
                    <th key={planId} className="px-6 py-4 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text">{planDef.name}</span>
                        <Badge variant={planBadge.variant}>{planBadge.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-text-muted">{PLAN_COPY[planId].priceLabel}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-b-0">
                  <th className="px-6 py-3 text-left font-medium text-text">{row.label}</th>
                  {PLAN_ORDER.map((planId) => {
                    const value = row.values[planId];
                    return (
                      <td key={planId} className="px-6 py-3 text-text-muted">
                        {typeof value === "boolean" ? (
                          value ? (
                            <Check size={18} strokeWidth={1.75} className="text-success" aria-label="Included" />
                          ) : (
                            <Minus size={18} strokeWidth={1.75} className="text-text-muted" aria-label="Not included" />
                          )
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-6 py-4" />
                {PLAN_ORDER.map((planId) => {
                  const copyPlan = PLAN_COPY[planId];
                  const href =
                    planId === data.currentTeam.planId
                      ? "/dashboard/plan"
                      : planId === "free"
                        ? "/dashboard"
                        : planId === "enterprise"
                          ? "/request-demo?interest=enterprise"
                          : `/dashboard/plan?upgrade=${planId}`;
                  return (
                    <td key={planId} className="px-6 py-4">
                      <Link
                        href={href}
                        className={cn(
                          buttonVariants({
                            variant: planId === data.currentTeam.planId ? "ghost" : copyPlan.ctaVariant,
                            size: "md",
                          }),
                          "w-full",
                        )}
                      >
                        {planId === data.currentTeam.planId ? "Current plan" : copyPlan.cta}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </AppCard>
      </Section>

      <Section title="Billing details">
        <AppCard className="p-6">
          <AppEmptyState
            title="Billing not connected yet"
            description="Payments are not enabled in this build. When ready, you can update payment details here."
            icon={<Info size={28} strokeWidth={1.75} aria-hidden />}
          />
        </AppCard>
      </Section>
    </AppPage>
  );
}
