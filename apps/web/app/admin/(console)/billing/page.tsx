import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { AppCard } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/billing/format";
import { getBillingOverview, type AdminCoupon } from "@/lib/admin";
import { cn } from "@/lib/utils";
import {
  createCoupon,
  createGrant,
  refundPaymentAction,
  resolveReviewItem,
  revokeGrant,
  saveBillingSettings,
  saveBillingTerm,
  toggleCoupon,
  voidInvoice,
} from "./actions";

export const dynamic = "force-dynamic";

function date(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(parsed)
    : "—";
}

function discount(row: AdminCoupon): string {
  if (row.percent_off_bps) return `${Number(row.percent_off_bps) / 100}% off`;
  if (row.amount_off_cents) return `${formatMoney(Number(row.amount_off_cents))} off`;
  return "—";
}

const fieldClass =
  "h-10 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-sm text-text";
const labelClass = "flex flex-col gap-1 text-[13px] font-medium text-text";

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const {
    settings,
    terms,
    coupons,
    grants,
    teams,
    plans,
    reviews,
    invoices,
    payments,
  } = await getBillingOverview();

  const teamName = new Map(teams.map((team) => [team.id, team.name] as const));
  const planName = new Map(plans.map((plan) => [plan.id, plan.name] as const));

  return (
    <AppPage width="default">
      <PageHeader
        title="Billing"
        description="Payment periods, discounts, plan grants and invoices."
        actions={
          <div className="flex gap-2">
            <Link href="/admin/teams" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Teams
            </Link>
            <Link href="/admin" className={buttonVariants({ variant: "secondary", size: "md" })}>
              Back to admin
            </Link>
          </div>
        }
      />

      {params.saved ? (
        <AppCard className="mb-4 p-4">
          <p className="text-sm font-medium text-success-text">{params.saved}</p>
        </AppCard>
      ) : null}
      {params.error ? (
        <AppCard className="mb-4 p-4">
          <p className="text-sm font-medium text-danger-text">{params.error}</p>
        </AppCard>
      ) : null}

      <Section title="Billing settings" description="These values apply to every team.">
        <AppCard className="p-5">
          <form action={saveBillingSettings} className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-3">
            <label className={labelClass}>
              Currency
              <input name="default_currency" defaultValue={String(settings?.default_currency ?? "USD")} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Grace days
              <input name="grace_days" type="number" min={0} max={365} defaultValue={Number(settings?.grace_days ?? 7)} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Reminder days before end
              <input name="reminder_days" defaultValue={Array.isArray(settings?.reminder_days) ? settings?.reminder_days.join(", ") : "30, 7, 1"} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Invoice expires after (days)
              <input name="invoice_expiry_days" type="number" min={1} max={365} defaultValue={Number(settings?.invoice_expiry_days ?? 14)} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Max unpaid invoices
              <input name="max_unpaid_invoices" type="number" min={1} max={50} defaultValue={Number(settings?.max_unpaid_invoices ?? 3)} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Tax rate (basis points)
              <input name="tax_rate_bps" type="number" min={0} max={10000} defaultValue={Number(settings?.tax_rate_bps ?? 0)} className={fieldClass} />
            </label>
            <label className={cn(labelClass, "min-[720px]:col-span-2")}>
              Pesapal IPN id
              <input name="pesapal_ipn_id" defaultValue={String(settings?.pesapal_ipn_id ?? "")} className={fieldClass} placeholder="Registered by the payment provider" />
            </label>
            <div className="flex items-end">
              <button type="submit" className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}>
                Save settings
              </button>
            </div>
          </form>
        </AppCard>
      </Section>

      <Section title="Payment periods" description="The discount is applied to the plan price before any discount code.">
        <AppCard className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Months</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Label</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Discount (bps)</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">On</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={String(term.months)} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium text-text">{String(term.months)}</td>
                  <td className="px-4 py-3" colSpan={4}>
                    <form action={saveBillingTerm} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="months" value={String(term.months)} />
                      <input name="label" defaultValue={String(term.label)} className={cn(fieldClass, "max-w-[160px]")} />
                      <input name="discount_bps" type="number" min={0} max={10000} defaultValue={Number(term.discount_bps)} className={cn(fieldClass, "max-w-[120px]")} />
                      <label className="flex items-center gap-2 text-sm text-text">
                        <input type="checkbox" name="active" defaultChecked={term.active !== false} />
                        On
                      </label>
                      <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AppCard>
      </Section>

      <Section title="Discount codes" description="Codes are checked on the server before an invoice is created.">
        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          <AppCard className="p-5">
            <h3 className="text-[15px] font-semibold text-text">Create a code</h3>
            <form action={createCoupon} className="mt-3 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
              <label className={labelClass}>
                Code
                <input name="code" required className={fieldClass} />
              </label>
              <label className={labelClass}>
                Percent off (bps)
                <input name="percent_off_bps" type="number" min={0} max={10000} className={fieldClass} />
              </label>
              <label className={labelClass}>
                Amount off (cents)
                <input name="amount_off_cents" type="number" min={0} className={fieldClass} />
              </label>
              <label className={labelClass}>
                Plans (comma separated)
                <input name="plan_ids" placeholder="basic, pro" className={fieldClass} />
              </label>
              <label className={labelClass}>
                Minimum months
                <input name="min_months" type="number" className={fieldClass} />
              </label>
              <label className={labelClass}>
                Max uses
                <input name="max_redemptions" type="number" min={1} className={fieldClass} />
              </label>
              <label className={labelClass}>
                Uses per team
                <input name="per_team_limit" type="number" min={1} className={fieldClass} />
              </label>
              <label className={labelClass}>
                Starts at
                <input name="starts_at" type="datetime-local" className={fieldClass} />
              </label>
              <label className={labelClass}>
                Ends at
                <input name="ends_at" type="datetime-local" className={fieldClass} />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-text">
                <input type="checkbox" name="first_purchase_only" />
                First payment only
              </label>
              <div className="min-[520px]:col-span-2">
                <button type="submit" className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}>
                  Create code
                </button>
              </div>
            </form>
          </AppCard>

          <AppCard className="p-5">
            <h3 className="text-[15px] font-semibold text-text">Codes</h3>
            <div className="mt-3 flex flex-col gap-3">
              {coupons.length === 0 ? (
                <p className="text-sm text-text-muted">No discount codes yet.</p>
              ) : (
                coupons.map((coupon) => (
                  <div key={String(coupon.id)} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-text">{String(coupon.code)}</p>
                      <p className="text-[13px] text-text-muted">
                        {discount(coupon)}
                        {coupon.min_months ? ` · min ${coupon.min_months} months` : ""}
                        {coupon.max_redemptions ? ` · max ${coupon.max_redemptions}` : ""}
                      </p>
                    </div>
                    <form action={toggleCoupon}>
                      <input type="hidden" name="id" value={String(coupon.id)} />
                      <input type="hidden" name="active" value={coupon.active ? "false" : "true"} />
                      <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        {coupon.active ? "Turn off" : "Turn on"}
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </AppCard>
        </div>
      </Section>

      <Section title="Plan grants" description="A grant gives a team a plan without a payment. It does not change invoices.">
        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          <AppCard className="p-5">
            <h3 className="text-[15px] font-semibold text-text">Add a grant</h3>
            <form action={createGrant} className="mt-3 flex flex-col gap-3">
              <label className={labelClass}>
                Team
                <select name="team_id" required className={fieldClass}>
                  <option value="">Choose a team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Plan
                <select name="plan_id" required className={fieldClass}>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Starts at
                <input name="starts_at" type="datetime-local" className={fieldClass} />
              </label>
              <label className={labelClass}>
                Ends at (leave empty for no end)
                <input name="ends_at" type="datetime-local" className={fieldClass} />
              </label>
              <label className={labelClass}>
                Reason
                <input name="note" required minLength={3} className={fieldClass} />
              </label>
              <button type="submit" className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}>
                Add grant
              </button>
            </form>
          </AppCard>

          <AppCard className="p-5">
            <h3 className="text-[15px] font-semibold text-text">Active grants</h3>
            <div className="mt-3 flex flex-col gap-3">
              {grants.length === 0 ? (
                <p className="text-sm text-text-muted">No active grants.</p>
              ) : (
                grants.map((grant) => (
                  <div key={String(grant.id)} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-text">
                        {teamName.get(String(grant.team_id)) ?? "Team"} · {planName.get(String(grant.plan_id)) ?? grant.plan_id}
                      </p>
                      <p className="text-[13px] text-text-muted">
                        {date(String(grant.starts_at))} → {grant.ends_at ? date(String(grant.ends_at)) : "no end"} · {String(grant.source)}
                        {grant.note ? ` · ${String(grant.note)}` : ""}
                      </p>
                    </div>
                    <form action={revokeGrant}>
                      <input type="hidden" name="id" value={String(grant.id)} />
                      <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        Remove
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </AppCard>
        </div>
      </Section>

      <Section title="Needs review" description="Payments that did not match an invoice are never marked paid.">
        <AppCard className="p-5">
          {reviews.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing needs review.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map((item) => (
                <div key={String(item.id)} className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <p className="text-sm font-semibold text-text">
                      {String(item.kind)} · {teamName.get(String(item.team_id)) ?? "Unknown team"}
                    </p>
                    <p className="text-[13px] text-text-muted">
                      {date(String(item.created_at))} · {JSON.stringify(item.details)}
                    </p>
                  </div>
                  <form action={resolveReviewItem}>
                    <input type="hidden" name="id" value={String(item.id)} />
                    <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Mark resolved
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </AppCard>
      </Section>

      <Section title="Recent payments" description="Refunds never delete a payment or an invoice.">
        <AppCard className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Team</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Amount</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Status</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Paid</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={String(payment.id)} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-text-muted">{teamName.get(String(payment.team_id)) ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{formatMoney(Number(payment.amount_cents), String(payment.currency))}</td>
                  <td className="px-4 py-3"><Badge variant="live">{String(payment.status)}</Badge></td>
                  <td className="px-4 py-3 text-text-muted">{date(String(payment.paid_at ?? ""))}</td>
                  <td className="px-4 py-3 text-right">
                    {["confirmed", "partly_refunded"].includes(String(payment.status)) ? (
                      <form action={refundPaymentAction} className="flex flex-wrap justify-end gap-2">
                        <input type="hidden" name="team_id" value={String(payment.team_id)} />
                        <input type="hidden" name="payment_id" value={String(payment.id)} />
                        <input name="amount_cents" type="number" min={1} max={Number(payment.amount_cents)} placeholder="Cents" required className={cn(fieldClass, "max-w-[110px]")} />
                        <input name="reason" placeholder="Reason" required minLength={3} className={cn(fieldClass, "max-w-[180px]")} />
                        <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          Refund
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AppCard>
      </Section>

      <Section title="Recent invoices">
        <AppCard className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Invoice</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Team</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Amount</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Status</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={String(invoice.id)} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium text-text">{String(invoice.number)}</td>
                  <td className="px-4 py-3 text-text-muted">{teamName.get(String(invoice.team_id)) ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{formatMoney(Number(invoice.total_cents), String(invoice.currency))}</td>
                  <td className="px-4 py-3"><Badge variant={invoice.status === "paid" ? "live" : "neutral"}>{String(invoice.status)}</Badge></td>
                  <td className="px-4 py-3 text-text-muted">{date(String(invoice.expires_at ?? ""))}</td>
                  <td className="px-4 py-3 text-right">
                    {["open", "payment_pending"].includes(String(invoice.status)) ? (
                      <form action={voidInvoice} className="flex justify-end gap-2">
                        <input type="hidden" name="id" value={String(invoice.id)} />
                        <input name="reason" placeholder="Reason" required minLength={3} className={cn(fieldClass, "max-w-[180px]")} />
                        <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          Cancel
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AppCard>
      </Section>
    </AppPage>
  );
}
