import { Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppCard } from "@/components/app/card";
import { AppEmptyState } from "@/components/app/empty-state";
import { AppPage } from "@/components/app/app-page";
import { InfoBox } from "@/components/app/info-box";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getShellData } from "@/lib/dashboard";
import { loadTeamBalance } from "@/lib/ai/settings";
import { PLAN_BY_ID } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  monthly: "Monthly credits",
  free_grant: "Free credits",
  bonus: "Bonus credits",
  referral: "Referral credits",
  purchase: "Bought credits",
  admin: "Added by the team",
};

function dateLabel(value: string | null): string {
  if (!value) return "No expiry";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function nextRefill(): string {
  const now = new Date();
  return dateLabel(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  );
}

export default async function AiCreditsPage() {
  const data = await getShellData();
  if (!data) redirect("/login");

  const plan = PLAN_BY_ID[data.currentTeam.planId] ?? PLAN_BY_ID.free;
  const admin = createAdminClient();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 29);
  start.setUTCHours(0, 0, 0, 0);

  const [balance, ledgerResult, usageResult] = await Promise.all([
    loadTeamBalance(admin, data.currentTeam.id),
    admin
      .from("credit_ledger")
      .select("id, created_at, kind, credits, balance_after, summary")
      .eq("team_id", data.currentTeam.id)
      .neq("kind", "reserve")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("ai_usage_daily")
      .select("day, credits, requests")
      .eq("team_id", data.currentTeam.id)
      .gte("day", start.toISOString().slice(0, 10))
      .order("day", { ascending: true }),
  ]);

  const buckets = balance.buckets as Array<{
    id?: string;
    kind?: string;
    available?: number;
    expiresAt?: string | null;
  }>;
  const ledger = ledgerResult.data ?? [];
  const usage = usageResult.data ?? [];
  const usedIn30Days = usage.reduce(
    (total, row) => total + Number(row.credits ?? 0),
    0,
  );
  const maxDay = Math.max(1, ...usage.map((row) => Number(row.credits ?? 0)));
  const lowCredits =
    balance.total < Math.max(5, Math.ceil(plan.aiMonthlyCredits * 0.2));

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: data.currentTeam.name, href: "/dashboard" },
          { label: "AI credits" },
        ]}
        title="AI credits"
        description="What you have left and where it went."
      />

      {lowCredits ? (
        <InfoBox className="mb-6">
          <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            <p className="text-sm text-text">
              You have {balance.total} AI credits left.
            </p>
            <Link
              href="/dashboard/plan"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              See plans
            </Link>
          </div>
        </InfoBox>
      ) : null}

      <div className="grid grid-cols-1 gap-6 min-[1024px]:grid-cols-12">
        <AppCard className="p-6 min-[1024px]:col-span-5">
          <p className="text-label-caps">Balance</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-heading text-[44px] font-bold leading-none text-text">
              {balance.total}
            </span>
            <span className="pb-1 text-base text-text-muted">credits left</span>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {buckets.length === 0 ? (
              <p className="text-sm text-text-muted">No credits yet.</p>
            ) : (
              buckets.map((bucket, index) => (
                <div
                  key={bucket.id ?? `${bucket.kind}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-input bg-surface-muted px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-text">
                      {KIND_LABELS[String(bucket.kind)] ?? "Credits"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {dateLabel(bucket.expiresAt ?? null)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-text">
                    {Number(bucket.available ?? 0)}
                  </span>
                </div>
              ))
            )}
          </div>

          {plan.aiMonthlyCredits > 0 ? (
            <p className="mt-4 text-sm text-text-muted">
              Next refill: {nextRefill()}
            </p>
          ) : (
            <InfoBox variant="info" className="mt-4">
              Free credits do not refill. Upgrade for monthly credits.
            </InfoBox>
          )}
        </AppCard>

        <AppCard className="p-6 min-[1024px]:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-label-caps">Credits used</p>
              <p className="mt-1 text-base text-text">
                {usedIn30Days} credits in 30 days
              </p>
            </div>
            <span className="text-sm text-text-muted">Last 30 days</span>
          </div>

          {usage.length === 0 ? (
            <p className="mt-6 text-sm text-text-muted">No AI use yet.</p>
          ) : (
            <ul className="mt-5 flex flex-col gap-2" aria-label="AI credits used each day">
              {usage.map((row) => (
                <li key={row.day} className="grid grid-cols-[72px_1fr_48px] items-center gap-3">
                  <span className="text-xs text-text-muted">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                    }).format(new Date(`${row.day}T00:00:00Z`))}
                  </span>
                  <Progress
                    value={(Number(row.credits ?? 0) / maxDay) * 100}
                    label={`${row.day}: ${row.credits ?? 0} credits`}
                  />
                  <span className="text-right text-xs font-semibold text-text">
                    {Number(row.credits ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      </div>

      <Section title="Where your credits went">
        <AppCard className="overflow-x-auto p-0">
          {ledger.length === 0 ? (
            <div className="p-6">
              <AppEmptyState
                compact
                icon={<Sparkles size={32} strokeWidth={1.75} aria-hidden />}
                title="No AI activity yet"
                description="When you use AI, the credits you use will show up here."
              />
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-label-caps text-text-muted">Date</th>
                  <th className="px-5 py-3 text-left text-label-caps text-text-muted">What happened</th>
                  <th className="px-5 py-3 text-right text-label-caps text-text-muted">Credits</th>
                  <th className="px-5 py-3 text-right text-label-caps text-text-muted">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => {
                  const credits = Number(row.credits ?? 0);
                  return (
                    <tr key={row.id} className="border-b border-border last:border-b-0">
                      <td className="whitespace-nowrap px-5 py-3 text-text-muted">
                        {dateLabel(row.created_at)}
                      </td>
                      <td className="px-5 py-3 text-text">
                        {row.summary ?? "AI credits changed"}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-3 text-right font-semibold",
                          credits < 0 ? "text-text" : "text-success-text",
                        )}
                      >
                        {credits > 0 ? `+${credits}` : credits}
                      </td>
                      <td className="px-5 py-3 text-right text-text-muted">
                        {Number(row.balance_after ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </AppCard>
      </Section>

      <Section title="How credits work">
        <AppCard className="p-6">
          <ul className="grid grid-cols-1 gap-4 text-sm text-text-muted min-[768px]:grid-cols-2">
            <li>AI shows you the price first.</li>
            <li>You only pay for what AI uses.</li>
            <li>If something goes wrong, you are not charged.</li>
            <li>Unused monthly credits last until the end of next month.</li>
          </ul>
          <Link
            href="/dashboard/plan"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }), "mt-5")}
          >
            Plans and credits
          </Link>
        </AppCard>
      </Section>
    </AppPage>
  );
}
