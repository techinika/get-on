import { emailLayout, button } from "@get-on/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/email/enqueue";
import { formatMoney } from "./format";

const BILLING_REPLY_TO = "team@get-on.tech";

async function ownerEmail(teamId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();
  if (!data?.user_id) return null;
  const { data: user } = await admin.auth.admin.getUserById(String(data.user_id));
  return user.user?.email ?? null;
}

async function billingAddress(teamId: string, invoiceId?: string): Promise<string | null> {
  const admin = createAdminClient();
  if (invoiceId) {
    const { data } = await admin
      .from("invoices")
      .select("billing_email")
      .eq("id", invoiceId)
      .maybeSingle();
    if (data?.billing_email) return String(data.billing_email);
  }
  const { data: billing } = await admin
    .from("team_billing")
    .select("billing_email")
    .eq("team_id", teamId)
    .maybeSingle();
  if (billing?.billing_email) return String(billing.billing_email);
  return ownerEmail(teamId);
}

async function claimNotification(
  teamId: string,
  kind: string,
  dedupeKey: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_notifications").insert({
    team_id: teamId,
    kind,
    dedupe_key: dedupeKey,
  });
  return !error;
}

async function markNotificationSent(
  teamId: string,
  dedupeKey: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("billing_notifications")
    .update({ sent_at: new Date().toISOString() })
    .eq("team_id", teamId)
    .eq("dedupe_key", dedupeKey);
}

async function sendBillingEmail(input: {
  teamId: string;
  invoiceId?: string;
  kind: string;
  dedupeKey: string;
  subject: string;
  heading: string;
  body: string[];
  action?: { label: string; href: string };
}): Promise<void> {
  const claimed = await claimNotification(input.teamId, input.kind, input.dedupeKey);
  if (!claimed) return;
  const to = await billingAddress(input.teamId, input.invoiceId);
  if (!to) return;

  const paragraphs = input.body
    .map((line) => `<p style="margin:0 0 16px 0;">${line}</p>`)
    .join("");
  const action = input.action
    ? button(input.action.href, input.action.label)
    : "";
  await enqueueEmail({
    kind: input.kind,
    toEmail: to,
    teamId: input.teamId,
    relatedType: input.invoiceId ? "invoice" : "team",
    relatedId: input.invoiceId ?? input.teamId,
    dedupeKey: `billing:${input.dedupeKey}`,
    payload: {
      subject: input.subject,
      text: [input.heading, "", ...input.body, input.action?.href ?? ""].join("\n"),
      html: emailLayout({
        title: input.heading,
        body: `<h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;">${input.heading}</h1>${paragraphs}${action}`,
      }),
      replyTo: BILLING_REPLY_TO,
    },
  });
  await markNotificationSent(input.teamId, input.dedupeKey);
}

export async function notifyPaymentConfirmed(invoiceId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, team_id, number, total_cents, currency, paid_at, plan_id, months")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return;
  await sendBillingEmail({
    teamId: String(invoice.team_id),
    invoiceId,
    kind: "billing_receipt",
    dedupeKey: `receipt:${invoiceId}`,
    subject: `Payment received for invoice ${invoice.number}`,
    heading: "Thank you — your payment is in",
    body: [
      `We received ${formatMoney(Number(invoice.total_cents), String(invoice.currency))} for invoice ${invoice.number}.`,
      "Your paid time has been added to your plan. Nothing renews automatically.",
    ],
    action: {
      label: "View your plan",
      href: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://get-on.tech"}/dashboard/plan`,
    },
  });
}

export async function notifyPaymentFailed(invoiceId: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, team_id, number, total_cents, currency")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return;
  await sendBillingEmail({
    teamId: String(invoice.team_id),
    invoiceId,
    kind: "billing_payment_failed",
    dedupeKey: `failed:${invoiceId}:${reason.slice(0, 40)}`,
    subject: `Payment for invoice ${invoice.number} did not go through`,
    heading: "Your payment did not go through",
    body: [
      `The payment for invoice ${invoice.number} was not completed. Your plan has not changed.`,
      "You can try again from your plan page. If money left your account, contact us and we will check it.",
    ],
    action: {
      label: "Try again",
      href: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://get-on.tech"}/dashboard/plan`,
    },
  });
}

async function teamName(teamId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("teams").select("name").eq("id", teamId).maybeSingle();
  return String(data?.name ?? "your team");
}

function planUrl(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://get-on.tech"}/dashboard/plan`;
}

export async function notifyRenewalReminder(input: {
  teamId: string;
  paidThrough: string;
  daysLeft: number;
  threshold: number;
}): Promise<void> {
  const name = await teamName(input.teamId);
  await sendBillingEmail({
    teamId: input.teamId,
    kind: "billing_renewal_reminder",
    dedupeKey: `renewal:${input.paidThrough}:${input.threshold}`,
    subject: `${name} paid time ends in ${input.daysLeft} day${input.daysLeft === 1 ? "" : "s"}`,
    heading: "Your paid time is coming to an end",
    body: [
      `The paid time for ${name} ends in ${input.daysLeft} day${input.daysLeft === 1 ? "" : "s"}.`,
      "We never charge you automatically. Open your plan page to create a renewal invoice when you are ready.",
    ],
    action: { label: "Renew your plan", href: planUrl() },
  });
}

export async function notifyGraceStarted(input: {
  teamId: string;
  paidThrough: string;
  graceEndsAt: string | null;
}): Promise<void> {
  const name = await teamName(input.teamId);
  await sendBillingEmail({
    teamId: input.teamId,
    kind: "billing_grace_started",
    dedupeKey: `grace:${input.paidThrough}`,
    subject: `Grace period for ${name}`,
    heading: "Your plan is in its grace period",
    body: [
      `The paid time for ${name} has ended, but your plan still works until ${input.graceEndsAt ?? "the grace period ends"}.`,
      "Your websites and files are safe. Create a renewal invoice to keep everything working.",
    ],
    action: { label: "Renew now", href: planUrl() },
  });
}

export async function notifyLapsed(input: {
  teamId: string;
  paidThrough: string;
}): Promise<void> {
  const name = await teamName(input.teamId);
  await sendBillingEmail({
    teamId: input.teamId,
    kind: "billing_lapsed",
    dedupeKey: `lapsed:${input.paidThrough}`,
    subject: `Your plan for ${name} has lapsed`,
    heading: "Your plan has lapsed",
    body: [
      `The grace period for ${name} has ended. Some features are paused, but nothing has been deleted.`,
      "Your websites and files are still here. Create a renewal invoice to restore your plan.",
    ],
    action: { label: "Restore your plan", href: planUrl() },
  });
}

export async function notifyDebt(input: {
  teamId: string;
  debtCents: number;
  currency: string;
}): Promise<void> {
  const name = await teamName(input.teamId);
  const month = new Date().toISOString().slice(0, 7);
  await sendBillingEmail({
    teamId: input.teamId,
    kind: "billing_debt_reminder",
    dedupeKey: `debt:${input.debtCents}:${month}`,
    subject: `Unpaid time for ${name}`,
    heading: "You have unpaid time",
    body: [
      `${name} has ${formatMoney(input.debtCents, input.currency)} in unpaid months.`,
      "A new payment settles the oldest unpaid months first. Nothing has been deleted.",
    ],
    action: { label: "View your plan", href: planUrl() },
  });
}

export async function notifyInvoiceExpired(input: {
  teamId: string;
  invoiceId: string;
  number: string;
}): Promise<void> {
  await sendBillingEmail({
    teamId: input.teamId,
    invoiceId: input.invoiceId,
    kind: "billing_invoice_expired",
    dedupeKey: `expired:${input.invoiceId}`,
    subject: `Invoice ${input.number} has expired`,
    heading: "An invoice has expired",
    body: [
      `Invoice ${input.number} has expired and can no longer be paid.`,
      "You can create a new invoice from your plan page at any time.",
    ],
    action: { label: "Create a new invoice", href: planUrl() },
  });
}

export async function notifyRefund(input: {
  teamId: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  status: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("number")
    .eq("id", input.invoiceId)
    .maybeSingle();
  await sendBillingEmail({
    teamId: input.teamId,
    invoiceId: input.invoiceId,
    kind: "billing_refund",
    dedupeKey: `refund:${input.invoiceId}:${input.amountCents}:${input.status}`,
    subject: `Refund update for invoice ${invoice?.number ?? ""}`,
    heading: input.status === "processed" ? "Your refund is on its way" : "Refund update",
    body: [
      `We recorded a refund of ${formatMoney(input.amountCents, input.currency)} for invoice ${invoice?.number ?? ""}.`,
      input.status === "processed"
        ? "Your bank or payment provider may take a few days to show it."
        : "The refund is still being checked. We will update you when it is done.",
    ],
    action: { label: "View your plan", href: planUrl() },
  });
}
