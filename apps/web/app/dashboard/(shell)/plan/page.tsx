import { Check, Info, Minus, ReceiptText, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  termOptionsWithPrices,
  type PlanId,
  type TermOption,
} from "@get-on/billing";
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
import {
  accessLabel,
  formatMoney,
  getBillingOverview,
  invoiceIsOpen,
} from "@/lib/billing/service";
import { getShellData } from "@/lib/dashboard";
import { PLAN_BY_ID } from "@/lib/plans";
import { COMPARE_ROWS, PLAN_COPY } from "@/lib/plan-copy";
import { cn } from "@/lib/utils";
import { checkoutAction, payDebtAction, payInvoiceAction } from "./actions";

const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "enterprise"];
const PAID_PLANS: PlanId[] = ["basic", "pro"];

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function lastIncludedDay(endExclusive: string | null | undefined): string {
  if (!endExclusive) return "—";
  const date = new Date(endExclusive);
  if (!Number.isFinite(date.getTime())) return "—";
  date.setUTCDate(date.getUTCDate() - 1);
  return formatDate(date.toISOString());
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string; error?: string; payment?: string }>;
}) {
  const data = await getShellData();
  if (!data) redirect("/login");

  const params = await searchParams;
  const overview = await getBillingOverview(data.currentTeam.id);
  const access = overview.access;
  const plan = PLAN_BY_ID[access.planId] ?? PLAN_BY_ID.free;
  const copy = PLAN_COPY[plan.id];
  const badge = PLAN_BADGE[plan.id];
  const canPay = data.currentTeam.role === "owner";
  const openInvoices = overview.invoices.filter(invoiceIsOpen);
  const upgrade = params.upgrade as PlanId | undefined;

  const storageBytes = data.usage.storageBytes ?? 0;
  const storageMbUsed = Math.max(0, Math.round((storageBytes / (1024 * 1024)) * 10) / 10);
  const usage = [
    { label: "Websites", used: data.usage.websites, limit: plan.maxWebsites },
    { label: "Team members", used: data.usage.members, limit: plan.maxMembers },
    { label: "AI credits left", used: data.usage.aiCredits ?? 0, limit: null },
    { label: "Storage (MB)", used: storageMbUsed, limit: plan.storageMb },
  ];

  const termOptions: TermOption[] = overview.terms.map((term) => ({
    months: term.months,
    discountBps: term.discountBps,
    label: term.label,
    active: term.active,
  }));

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

      {params.error ? (
        <InfoBox className="mb-6" variant="warning">
          <p className="text-sm font-medium text-text">{params.error}</p>
        </InfoBox>
      ) : null}

      {params.payment === "cancelled" ? (
        <InfoBox className="mb-6">
          <p className="text-sm text-text">
            Payment was cancelled. Your plan has not changed and your websites are safe.
          </p>
        </InfoBox>
      ) : null}

      {access.status === "grace" ? (
        <InfoBox className="mb-6" variant="warning">
          <p className="text-sm font-medium text-text">
            Your paid time ended on {lastIncludedDay(access.paidThrough)}.
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Your plan keeps working until {formatDate(access.graceEndsAt)}. Pay an open
            invoice before then to keep everything as it is.
          </p>
        </InfoBox>
      ) : null}

      {access.status === "lapsed" ? (
        <InfoBox className="mb-6" variant="warning">
          <p className="text-sm font-medium text-text">
            Your plan has lapsed. Your websites and files are safe.
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Some features are paused until you pay. Nothing has been deleted.
          </p>
        </InfoBox>
      ) : null}

      {overview.access.debtCents > 0 ? (
        <InfoBox className="mb-6" variant="warning">
          <p className="text-sm font-medium text-text">
            Unpaid months: {formatMoney(overview.access.debtCents, "USD")}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            A new payment settles the oldest unpaid months first.
          </p>
          {canPay ? (
            <form action={payDebtAction} className="mt-3">
              <button
                type="submit"
                className={cn(buttonVariants({ variant: "primary", size: "md" }))}
              >
                Pay what is owed
              </button>
            </form>
          ) : null}
        </InfoBox>
      ) : null}

      {upgrade && PLAN_BY_ID[upgrade] ? (
        <InfoBox className="mb-6">
          <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            <div>
              <p className="text-base font-semibold text-text">
                Switch to {PLAN_BY_ID[upgrade].name}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Choose a payment period below. Your new time starts after your current paid time.
              </p>
            </div>
            <Link
              href="/dashboard/plan"
              className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
            >
              View plans
            </Link>
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
              <Badge variant={access.status === "active" ? "live" : "draft"}>
                {accessLabel(access)}
              </Badge>
            </div>
            <p className="mt-3 text-base text-text-muted">{copy.priceLabel}</p>
            <p className="mt-1 text-[15px] text-text-muted">{copy.summary}</p>
            <dl className="mt-5 grid grid-cols-1 gap-3 text-sm min-[480px]:grid-cols-2">
              <div>
                <dt className="text-text-muted">Paid through</dt>
                <dd className="mt-1 font-medium text-text">
                  {access.paidThrough ? lastIncludedDay(access.paidThrough) : "Not paid yet"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Next payment</dt>
                <dd className="mt-1 font-medium text-text">
                  {overview.coverage.nextStart ? formatDate(overview.coverage.nextStart) : "None"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Billing</dt>
                <dd className="mt-1 font-medium text-text">Prepaid, no auto-renewal</dd>
              </div>
              <div>
                <dt className="text-text-muted">Open invoices</dt>
                <dd className="mt-1 font-medium text-text">{openInvoices.length}</dd>
              </div>
            </dl>
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
        title="Choose a plan"
        description="Pick a plan and how long you want to pay for. Your time starts after the time you already paid for."
      >
        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          {PAID_PLANS.map((planId) => {
            const planDef = PLAN_BY_ID[planId];
            const planCopy = PLAN_COPY[planId];
            const planBadge = PLAN_BADGE[planId];
            const prices = termOptionsWithPrices(planId, termOptions);
            return (
              <AppCard key={planId} className="flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-xl font-semibold text-text">
                        {planDef.name}
                      </h3>
                      <Badge variant={planBadge.variant}>{planBadge.label}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-text-muted">{planCopy.summary}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold text-text">
                    {planCopy.priceLabel}
                  </p>
                </div>
                <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-text-muted">
                  {planCopy.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-success" aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {canPay ? (
                  <form action={checkoutAction} className="mt-5 flex flex-col gap-3">
                    <input type="hidden" name="plan" value={planId} />
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-text">
                      Payment period
                      <select
                        name="months"
                        defaultValue="12"
                        className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text"
                      >
                        {prices.map((term) => (
                          <option key={term.months} value={term.months}>
                            {term.label} — {formatMoney(term.totalCents)} total
                            {term.savingsCents > 0
                              ? ` (save ${formatMoney(term.savingsCents)})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-text">
                      Discount code (optional)
                      <input
                        name="coupon"
                        autoComplete="off"
                        className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text"
                      />
                    </label>
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}
                    >
                      Continue to payment
                    </button>
                  </form>
                ) : (
                  <p className="mt-5 text-sm text-text-muted">
                    Only the team owner can pay or change the plan.
                  </p>
                )}
              </AppCard>
            );
          })}
        </div>
      </Section>

      {openInvoices.length > 0 ? (
        <Section title="Open invoices" description="Pay an invoice to add time to your plan.">
          <div className="flex flex-col gap-3">
            {openInvoices.map((invoice) => (
              <AppCard key={invoice.id} className="p-5">
                <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <ReceiptText size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-text">
                        {invoice.number} · {formatMoney(invoice.totalCents, invoice.currency)}
                      </p>
                      <p className="mt-1 text-sm text-text-muted">
                        {invoice.kind === "renewal" ? "Renewal" : "Plan payment"} ·{" "}
                        {invoice.months ?? 0} months · expires {formatDate(invoice.expiresAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/plan/invoices/${invoice.id}`}
                      className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
                    >
                      View invoice
                    </Link>
                    {canPay ? (
                      <form action={payInvoiceAction}>
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button
                          type="submit"
                          className={cn(buttonVariants({ variant: "primary", size: "md" }))}
                        >
                          Pay now
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </AppCard>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Billing history">
        {overview.invoices.length === 0 ? (
          <AppCard className="p-6">
            <AppEmptyState
              title="No invoices yet"
              description="When you pay for a plan, your invoices will appear here."
              icon={<Info size={28} strokeWidth={1.75} aria-hidden />}
            />
          </AppCard>
        ) : (
          <AppCard className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-label-caps text-text-muted">Invoice</th>
                  <th className="px-6 py-3 text-left text-label-caps text-text-muted">Date</th>
                  <th className="px-6 py-3 text-left text-label-caps text-text-muted">Amount</th>
                  <th className="px-6 py-3 text-left text-label-caps text-text-muted">Status</th>
                  <th className="px-6 py-3 text-right text-label-caps text-text-muted">Details</th>
                </tr>
              </thead>
              <tbody>
                {overview.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border last:border-b-0">
                    <td className="px-6 py-3 font-medium text-text">{invoice.number}</td>
                    <td className="px-6 py-3 text-text-muted">{formatDate(invoice.createdAt)}</td>
                    <td className="px-6 py-3 text-text-muted">
                      {formatMoney(invoice.totalCents, invoice.currency)}
                    </td>
                    <td className="px-6 py-3 text-text-muted">{invoice.status}</td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/dashboard/plan/invoices/${invoice.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AppCard>
        )}
      </Section>

      <AppCard className="mt-4 p-5">
        <div className="flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-text">AI credits</p>
              <p className="mt-1 text-sm text-text-muted">
                See what AI wrote for your team and what it cost.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/ai"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
          >
            View AI credits
          </Link>
        </div>
      </AppCard>

      <Section
        title="Compare plans"
        description="Your plan applies to everyone in your team. You can change it when your paid time ends."
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
                    planId === access.planId
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
                            variant: planId === access.planId ? "ghost" : copyPlan.ctaVariant,
                            size: "md",
                          }),
                          "w-full",
                        )}
                      >
                        {planId === access.planId ? "Current plan" : copyPlan.cta}
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
          <dl className="grid grid-cols-1 gap-4 text-sm min-[640px]:grid-cols-2">
            <div>
              <dt className="text-text-muted">Billing email</dt>
              <dd className="mt-1 font-medium text-text">
                {overview.invoices[0]?.billingEmail ?? "Not set yet"}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Payment provider</dt>
              <dd className="mt-1 font-medium text-text">Pesapal</dd>
            </div>
            <div>
              <dt className="text-text-muted">Auto-renewal</dt>
              <dd className="mt-1 font-medium text-text">Off. We never charge you automatically.</dd>
            </div>
            <div>
              <dt className="text-text-muted">Invoice expiry</dt>
              <dd className="mt-1 font-medium text-text">
                {overview.settings.invoiceExpiryDays} days after we create it
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-text-muted">
            We will remind you before your paid time ends. You can create a new invoice from
            this page at any time.
          </p>
        </AppCard>
      </Section>
    </AppPage>
  );
}
