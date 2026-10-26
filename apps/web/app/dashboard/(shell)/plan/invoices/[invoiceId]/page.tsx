import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney, getInvoice } from "@/lib/billing/service";
import { getShellData } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { payInvoiceAction } from "../../actions";

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

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const data = await getShellData();
  if (!data) redirect("/login");
  const { invoiceId } = await params;
  const result = await getInvoice(data.currentTeam.id, invoiceId);
  if (!result) notFound();

  const invoice = result.raw as Record<string, unknown>;
  const canPay = data.currentTeam.role === "owner";
  const open =
    (invoice.status === "open" || invoice.status === "payment_pending") &&
    (!invoice.expires_at ||
      new Date(String(invoice.expires_at)).getTime() > new Date().getTime());

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: data.currentTeam.name, href: "/dashboard" },
          { label: "Plan and billing", href: "/dashboard/plan" },
          { label: String(invoice.number ?? "Invoice") },
        ]}
        title={`Invoice ${String(invoice.number ?? "")}`}
        description={`Created ${formatDate(String(invoice.created_at ?? ""))}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/dashboard/plan/invoices/${invoiceId}/pdf`}
              className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
            >
              Download PDF
            </a>
            <a
              href={`/dashboard/plan/invoices/${invoiceId}/pdf`}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
            >
              Print
            </a>
            <Link
              href="/dashboard/plan"
              className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
            >
              Back to billing
            </Link>
          </div>
        }
      />

      <AppCard className="p-6">
        <div className="flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
          <div>
            <p className="text-label-caps">Amount</p>
            <p className="mt-2 font-heading text-3xl font-bold text-text">
              {formatMoney(Number(invoice.total_cents ?? 0), String(invoice.currency ?? "USD"))}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {invoice.status === "paid"
                ? `Paid ${formatDate(String(invoice.paid_at ?? ""))}`
                : `Due ${formatDate(String(invoice.due_at ?? ""))} · expires ${formatDate(String(invoice.expires_at ?? ""))}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={invoice.status === "paid" ? "live" : "draft"}>
              {String(invoice.status ?? "open")}
            </Badge>
            {open && canPay ? (
              <form action={payInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoiceId} />
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

      <AppCard className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-label-caps text-text-muted">Description</th>
              <th className="px-6 py-3 text-right text-label-caps text-text-muted">Amount</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((line) => (
              <tr key={String(line.id)} className="border-b border-border last:border-b-0">
                <td className="px-6 py-3 text-text">{String(line.description)}</td>
                <td className="px-6 py-3 text-right text-text-muted">
                  {formatMoney(Number(line.amount_cents), String(invoice.currency ?? "USD"))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-6 py-2 text-right text-text-muted">Discount</td>
              <td className="px-6 py-2 text-right text-text-muted">
                −{formatMoney(Number(invoice.discount_cents ?? 0), String(invoice.currency ?? "USD"))}
              </td>
            </tr>
            <tr>
              <td className="px-6 py-2 text-right text-text-muted">Tax</td>
              <td className="px-6 py-2 text-right text-text-muted">
                {formatMoney(Number(invoice.tax_cents ?? 0), String(invoice.currency ?? "USD"))}
              </td>
            </tr>
            <tr>
              <td className="px-6 py-3 text-right font-semibold text-text">Total</td>
              <td className="px-6 py-3 text-right font-semibold text-text">
                {formatMoney(Number(invoice.total_cents ?? 0), String(invoice.currency ?? "USD"))}
              </td>
            </tr>
          </tfoot>
        </table>
      </AppCard>

      <AppCard className="mt-4 p-6">
        <p className="text-label-caps">Payment details</p>
        <dl className="mt-3 grid grid-cols-1 gap-4 text-sm min-[640px]:grid-cols-2">
          <div>
            <dt className="text-text-muted">Billed to</dt>
            <dd className="mt-1 font-medium text-text">
              {String(invoice.billing_name ?? data.currentTeam.name)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Billing email</dt>
            <dd className="mt-1 font-medium text-text">
              {String(invoice.billing_email ?? "Not set")}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Plan</dt>
            <dd className="mt-1 font-medium text-text">
              {String(invoice.plan_id ?? "—")}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Payment period</dt>
            <dd className="mt-1 font-medium text-text">
              {String(invoice.months ?? "—")} months
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-text-muted">
          This is a prepaid invoice. No card is saved and we never charge you automatically.
        </p>
      </AppCard>
    </AppPage>
  );
}
