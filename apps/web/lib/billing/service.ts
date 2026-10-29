import { randomBytes } from "node:crypto";
import {
  coverageSummary,
  nextTermStart,
  quote as priceQuote,
  termEnd,
  validateCoupon,
  type Coupon,
  type PlanId,
  type Quote,
  type TermMonths,
  type TermOption,
  type TeamAccess,
} from "@get-on/billing";
import { can, type Action, type Role } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appOrigin,
  PaymentProviderError,
  type ProviderTransaction,
} from "./provider";
import { getPaymentProvider } from "./index";
import { formatMoney } from "./format";
import { notifyPaymentConfirmed, notifyPaymentFailed, notifyRefund } from "./email";

export class BillingError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BillingError";
    this.code = code;
  }
}

type Row = Record<string, unknown>;

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function asPlanId(value: unknown): PlanId {
  return value === "basic" || value === "pro" || value === "enterprise"
    ? value
    : "free";
}

export type BillingAccess = TeamAccess & { debtCents: number };

export type BillingSettings = {
  defaultCurrency: string;
  graceDays: number;
  reminderDays: number[];
  invoiceExpiryDays: number;
  maxUnpaidInvoices: number;
  taxRateBps: number;
  pesapalIpnId: string | null;
};

export type BillingTerm = {
  months: TermMonths;
  discountBps: number;
  label: string;
  active: boolean;
  sort: number;
};

export type BillingInvoice = {
  id: string;
  number: string;
  status: string;
  kind: string;
  planId: string | null;
  months: number | null;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  dueAt: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  couponCode: string | null;
  billingEmail: string | null;
  billingName: string | null;
};

export type BillingPayment = {
  id: string;
  invoiceId: string;
  provider: string;
  providerReference: string;
  amountCents: number;
  currency: string;
  status: string;
  method: string | null;
  paidAt: string;
};

export type BillingOverview = {
  teamId: string;
  access: BillingAccess;
  settings: BillingSettings;
  terms: BillingTerm[];
  invoices: BillingInvoice[];
  payments: BillingPayment[];
  subscriptionTerms: Array<{
    id: string;
    planId: string;
    months: number;
    startsAt: string;
    endsAt: string;
    status: string;
    invoiceId: string | null;
  }>;
  grants: Array<{
    id: string;
    planId: string;
    startsAt: string;
    endsAt: string | null;
    source: string;
    note: string | null;
  }>;
  coverage: ReturnType<typeof coverageSummary>;
};

function normalizeAccess(raw: Row): BillingAccess {
  return {
    planId: asPlanId(raw.plan_id),
    source: (raw.source as BillingAccess["source"]) ?? "free",
    status: (raw.status as BillingAccess["status"]) ?? "free",
    paidThrough: nullableString(raw.paid_through),
    graceEndsAt: nullableString(raw.grace_ends_at),
    currentTermId: nullableString(raw.current_term_id),
    grantId: nullableString(raw.grant_id),
    debtCents: number(raw.debt_cents),
    limits: raw.limits as BillingAccess["limits"],
    features: raw.features as BillingAccess["features"],
  };
}

export async function getTeamAccess(teamId: string): Promise<BillingAccess> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_resolve_team", {
    p_team: teamId,
  });
  if (error) throw new BillingError("BILLING_ACCESS_FAILED", error.message);
  return normalizeAccess((data ?? {}) as Row);
}

export async function refreshTeamBilling(teamId: string): Promise<BillingAccess> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_refresh_team", {
    p_team: teamId,
  });
  if (error) throw new BillingError("BILLING_REFRESH_FAILED", error.message);
  return normalizeAccess((data ?? {}) as Row);
}

export async function getBillingAccountCredit(teamId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_credit_balance", {
    p_team: teamId,
  });
  if (error) throw new BillingError("BILLING_CREDIT_FAILED", error.message);
  return Number(data ?? 0);
}

export async function adjustBillingCredit(input: {
  teamId: string;
  amountCents: number;
  source?: string;
  note?: string;
  approvalId?: string | null;
  createdBy?: string | null;
}): Promise<{ balanceCents: number; duplicate?: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_credit_adjust", {
    p_team: input.teamId,
    p_amount_cents: input.amountCents,
    p_currency: "USD",
    p_source: input.source ?? "admin",
    p_note: input.note ?? "Account credit",
    p_approval_id: input.approvalId ?? null,
    p_created_by: input.createdBy ?? null,
  });
  if (error) throw new BillingError("BILLING_CREDIT_FAILED", error.message);
  const result = (data ?? {}) as Row;
  if (result.ok !== true) {
    throw new BillingError("BILLING_CREDIT_FAILED", "The credit adjustment did not complete.");
  }
  return {
    balanceCents: Number(result.balance_cents ?? 0),
    duplicate: result.duplicate === true,
  };
}

export async function getBillingSettings(): Promise<BillingSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_settings")
    .select(
      "default_currency, grace_days, reminder_days, invoice_expiry_days, max_unpaid_invoices, tax_rate_bps, pesapal_ipn_id",
    )
    .eq("id", 1)
    .maybeSingle();
  return {
    defaultCurrency: string(data?.default_currency) || "USD",
    graceDays: number(data?.grace_days ?? 7),
    reminderDays: Array.isArray(data?.reminder_days)
      ? (data?.reminder_days as number[])
      : [30, 7, 1],
    invoiceExpiryDays: number(data?.invoice_expiry_days ?? 14),
    maxUnpaidInvoices: number(data?.max_unpaid_invoices ?? 3),
    taxRateBps: number(data?.tax_rate_bps ?? 0),
    pesapalIpnId: nullableString(data?.pesapal_ipn_id),
  };
}

export async function getBillingTerms(): Promise<BillingTerm[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_terms")
    .select("months, discount_bps, label, active, sort")
    .order("sort", { ascending: true });
  return (data ?? [])
    .filter((row) => row.active !== false)
    .map((row) => ({
      months: number(row.months) as TermMonths,
      discountBps: number(row.discount_bps),
      label: string(row.label),
      active: row.active !== false,
      sort: number(row.sort),
    }));
}

export async function getBillingOverview(teamId: string): Promise<BillingOverview> {
  const admin = createAdminClient();
  const [access, settings, terms, invoiceRows, paymentRows, termRows, grantRows] =
    await Promise.all([
      getTeamAccess(teamId),
      getBillingSettings(),
      getBillingTerms(),
      admin
        .from("invoices")
        .select(
          "id, number, status, kind, plan_id, months, currency, subtotal_cents, discount_cents, tax_cents, total_cents, amount_paid_cents, coverage_start, coverage_end, due_at, expires_at, paid_at, created_at, coupon_code, billing_email, billing_name",
        )
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(24),
      admin
        .from("payments")
        .select(
          "id, invoice_id, provider, provider_reference, amount_cents, currency, status, method, paid_at",
        )
        .eq("team_id", teamId)
        .order("paid_at", { ascending: false })
        .limit(24),
      admin
        .from("subscription_terms")
        .select("id, plan_id, months, starts_at, ends_at, status, invoice_id")
        .eq("team_id", teamId)
        .order("starts_at", { ascending: true }),
      admin
        .from("access_grants")
        .select("id, plan_id, starts_at, ends_at, source, note")
        .eq("team_id", teamId)
        .is("revoked_at", null)
        .order("starts_at", { ascending: false }),
    ]);

  const subscriptionTerms = (termRows.data ?? []).map((row) => ({
    id: string(row.id),
    planId: string(row.plan_id),
    months: number(row.months),
    startsAt: string(row.starts_at),
    endsAt: string(row.ends_at),
    status: string(row.status),
    invoiceId: nullableString(row.invoice_id),
  }));

  return {
    teamId,
    access,
    settings,
    terms,
    invoices: (invoiceRows.data ?? []).map(mapInvoice),
    payments: (paymentRows.data ?? []).map((row) => ({
      id: string(row.id),
      invoiceId: string(row.invoice_id),
      provider: string(row.provider),
      providerReference: string(row.provider_reference),
      amountCents: number(row.amount_cents),
      currency: string(row.currency),
      status: string(row.status),
      method: nullableString(row.method),
      paidAt: string(row.paid_at),
    })),
    subscriptionTerms,
    grants: (grantRows.data ?? []).map((row) => ({
      id: string(row.id),
      planId: string(row.plan_id),
      startsAt: string(row.starts_at),
      endsAt: nullableString(row.ends_at),
      source: string(row.source),
      note: nullableString(row.note),
    })),
    coverage: coverageSummary(
      subscriptionTerms.map((term) => ({
        id: term.id,
        teamId,
        planId: asPlanId(term.planId),
        startsAt: term.startsAt,
        endsAt: term.endsAt,
        status: term.status as "upcoming" | "active" | "ended" | "cancelled",
        invoiceId: term.invoiceId,
      })),
      new Date(),
    ),
  };
}

function mapInvoice(row: Row): BillingInvoice {
  return {
    id: string(row.id),
    number: string(row.number),
    status: string(row.status),
    kind: string(row.kind),
    planId: nullableString(row.plan_id),
    months: row.months === null || row.months === undefined ? null : number(row.months),
    currency: string(row.currency),
    subtotalCents: number(row.subtotal_cents),
    discountCents: number(row.discount_cents),
    taxCents: number(row.tax_cents),
    totalCents: number(row.total_cents),
    amountPaidCents: number(row.amount_paid_cents),
    coverageStart: nullableString(row.coverage_start),
    coverageEnd: nullableString(row.coverage_end),
    dueAt: nullableString(row.due_at),
    expiresAt: nullableString(row.expires_at),
    paidAt: nullableString(row.paid_at),
    createdAt: string(row.created_at),
    couponCode: nullableString(row.coupon_code),
    billingEmail: nullableString(row.billing_email),
    billingName: nullableString(row.billing_name),
  };
}

export async function getInvoice(teamId: string, invoiceId: string) {
  const admin = createAdminClient();
  const [{ data: invoice }, { data: lines }, { data: attempts }] = await Promise.all([
    admin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("team_id", teamId)
      .maybeSingle(),
    admin
      .from("invoice_lines")
      .select("id, description, quantity, unit_amount_cents, amount_cents, sort")
      .eq("invoice_id", invoiceId)
      .order("sort", { ascending: true }),
    admin
      .from("payment_attempts")
      .select("id, provider, merchant_reference, status, redirect_url, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false }),
  ]);
  if (!invoice) return null;
  return { invoice: mapInvoice(invoice as Row), raw: invoice, lines: lines ?? [], attempts: attempts ?? [] };
}

async function membershipRole(teamId: string, userId: string): Promise<Role | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const role = string(data?.role);
  return role === "owner" || role === "admin" || role === "editor" || role === "viewer"
    ? role
    : null;
}

export async function requireBillingAction(
  teamId: string,
  userId: string,
  action: Action,
): Promise<Role> {
  const role = await membershipRole(teamId, userId);
  if (!role || !can(role, action)) {
    throw new BillingError("NOT_ALLOWED", "You cannot do that for this team.");
  }
  return role;
}

function couponFromRow(row: Row | null): Coupon | null {
  if (!row) return null;
  return {
    code: string(row.code),
    active: row.active !== false,
    percentOffBps:
      row.percent_off_bps === null || row.percent_off_bps === undefined
        ? null
        : number(row.percent_off_bps),
    amountOffCents:
      row.amount_off_cents === null || row.amount_off_cents === undefined
        ? null
        : number(row.amount_off_cents),
    planIds: Array.isArray(row.plan_ids)
      ? (row.plan_ids as PlanId[])
      : null,
    minMonths:
      row.min_months === null || row.min_months === undefined
        ? null
        : number(row.min_months),
    firstPurchaseOnly: row.first_purchase_only === true,
    startsAt: nullableString(row.starts_at),
    endsAt: nullableString(row.ends_at),
    maxRedemptions:
      row.max_redemptions === null || row.max_redemptions === undefined
        ? null
        : number(row.max_redemptions),
    perTeamLimit:
      row.per_team_limit === null || row.per_team_limit === undefined
        ? null
        : number(row.per_team_limit),
  };
}

async function couponContext(teamId: string, code: string) {
  const admin = createAdminClient();
  const upper = code.trim().toUpperCase();
  const [{ data: row }, { data: terms }, { count: redemptionCount }, { count: teamCount }] =
    await Promise.all([
      admin.from("coupons").select("*").eq("code", upper).maybeSingle(),
      admin.from("subscription_terms").select("id").eq("team_id", teamId).limit(1),
      admin
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .in("status", ["reserved", "redeemed"]),
      admin
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .in("status", ["reserved", "redeemed"]),
    ]);
  const coupon = couponFromRow((row ?? null) as Row | null);
  return {
    row,
    coupon,
    redemptionCount: redemptionCount ?? 0,
    teamRedemptionCount: teamCount ?? 0,
    firstPurchase: !terms || terms.length === 0,
  };
}

export type CheckoutQuote = {
  planId: PlanId;
  planName: string;
  months: TermMonths;
  termLabel: string;
  kind: "subscription" | "renewal";
  quote: Quote;
  chargeCurrency: string;
  exchangeRate: number;
  chargeSubtotalCents: number;
  chargeDiscountCents: number;
  chargeTaxCents: number;
  chargeTotalCents: number;
  accountCreditCents: number;
  coverageStart: string;
  coverageEnd: string;
  couponMessage: string | null;
  debtCents: number;
};

export async function buildCheckoutQuote(input: {
  teamId: string;
  planId: PlanId;
  months: TermMonths;
  couponCode?: string | null;
  now?: Date;
}): Promise<CheckoutQuote> {
  if (input.planId === "free") {
    throw new BillingError("BAD_PLAN", "The Free plan does not need a payment.");
  }
  const admin = createAdminClient();
  const now = input.now ?? new Date();
  const [settings, terms, access, termRows, { data: plan }] = await Promise.all([
    getBillingSettings(),
    getBillingTerms(),
    getTeamAccess(input.teamId),
    admin
      .from("subscription_terms")
      .select("id, plan_id, starts_at, ends_at, status")
      .eq("team_id", input.teamId),
    admin.from("plans").select("id, name, price_usd_monthly").eq("id", input.planId).maybeSingle(),
  ]);
  if (!plan) throw new BillingError("BAD_PLAN", "That plan is not available.");

  const termOptions: TermOption[] = terms.map((term) => ({
    months: term.months,
    discountBps: term.discountBps,
    label: term.label,
    active: term.active,
  }));

  let coupon: Coupon | null = null;
  let couponMessage: string | null = null;
  if (input.couponCode?.trim()) {
    const context = await couponContext(input.teamId, input.couponCode);
    const checked = validateCoupon(context.coupon, {
      planId: input.planId,
      months: input.months,
      now,
      firstPurchase: context.firstPurchase,
      redemptionCount: context.redemptionCount,
      teamRedemptionCount: context.teamRedemptionCount,
    });
    if (!checked.ok) {
      couponMessage = checked.message;
    } else {
      coupon = checked.coupon;
    }
    await admin.from("coupon_attempts").insert({
      code: input.couponCode.trim().toUpperCase(),
      team_id: input.teamId,
      success: checked.ok,
      reason: checked.ok ? null : checked.reason,
    });
  }

  const firstPurchase = (termRows.data ?? []).length === 0;
  const priced = priceQuote({
    planId: input.planId,
    months: input.months,
    terms: termOptions,
    coupon,
    taxRateBps: settings.taxRateBps,
    currency: settings.defaultCurrency,
    now,
    firstPurchase,
  });

  const subscriptionTerms = (termRows.data ?? []).map((row) => ({
    id: string(row.id),
    teamId: input.teamId,
    planId: asPlanId(row.plan_id),
    startsAt: string(row.starts_at),
    endsAt: string(row.ends_at),
    status: string(row.status) as "upcoming" | "active" | "ended" | "cancelled",
    invoiceId: null,
  }));
  const start = nextTermStart(subscriptionTerms, now);
  const end = termEnd(start, input.months);

  let exchangeRate = 1;
  if (settings.defaultCurrency !== "USD") {
    const { data: rate } = await admin
      .from("exchange_rates")
      .select("rate_from_usd")
      .eq("currency", settings.defaultCurrency)
      .order("effective_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    exchangeRate = number(rate?.rate_from_usd) || 1;
  }

  const chargeSubtotalCents = Math.round(priced.grossCents * exchangeRate);
  const chargeDiscountCents = Math.round(
    (priced.termDiscountCents + priced.couponDiscountCents) * exchangeRate,
  );
  const chargeTaxCents = Math.round(priced.taxCents * exchangeRate);
  const chargeTotalCents =
    chargeSubtotalCents - chargeDiscountCents + chargeTaxCents;
  const accountCreditCents = Math.min(
    Math.max(0, await getBillingAccountCredit(input.teamId)),
    chargeTotalCents,
  );
  const chargeTotalAfterCredit = chargeTotalCents - accountCreditCents;

  const termLabel =
    termOptions.find((term) => term.months === input.months)?.label ??
    `${input.months} months`;

  return {
    planId: input.planId,
    planName: string(plan.name),
    months: input.months,
    termLabel,
    kind: subscriptionTerms.length === 0 ? "subscription" : "renewal",
    quote: priced,
    chargeCurrency: settings.defaultCurrency,
    exchangeRate,
    chargeSubtotalCents,
    chargeDiscountCents,
    chargeTaxCents,
    chargeTotalCents: chargeTotalAfterCredit,
    accountCreditCents,
    coverageStart: start.toISOString(),
    coverageEnd: end.toISOString(),
    couponMessage,
    debtCents: access.debtCents,
  };
}


export async function createDebtInvoice(input: {
  teamId: string;
  actorId: string;
}): Promise<BillingInvoice> {
  const access = await getTeamAccess(input.teamId);
  if (access.debtCents <= 0) {
    throw new BillingError("NO_DEBT", "There are no unpaid months.");
  }
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("invoices")
    .select("id")
    .eq("team_id", input.teamId)
    .eq("kind", "debt")
    .in("status", ["open", "payment_pending"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    const found = await getInvoice(input.teamId, String(existing.id));
    if (found) return found.invoice;
  }

  const settings = await getBillingSettings();
  const expiresAt = new Date(
    Date.now() + settings.invoiceExpiryDays * 24 * 60 * 60 * 1000,
  );
  const { data, error } = await admin.rpc("billing_create_invoice", {
    p_team: input.teamId,
    p_kind: "debt",
    p_plan: null,
    p_months: null,
    p_currency: "USD",
    p_exchange_rate: 1,
    p_subtotal_cents: access.debtCents,
    p_discount_cents: 0,
    p_tax_cents: 0,
    p_total_cents: access.debtCents,
    p_coverage_start: null,
    p_coverage_end: null,
    p_due_at: new Date().toISOString(),
    p_expires_at: expiresAt.toISOString(),
    p_coupon_code: null,
    p_description: "Unpaid months",
    p_notes: null,
    p_created_by: input.actorId,
    p_metadata: { source: "debt" },
  });
  if (error) throw new BillingError("INVOICE_CREATE_FAILED", error.message);
  const invoiceId = string((data as Row)?.id);
  const result = await getInvoice(input.teamId, invoiceId);
  if (!result) throw new BillingError("INVOICE_CREATE_FAILED", "Invoice was not saved.");
  return result.invoice;
}

export async function createInvoiceForCheckout(input: {
  teamId: string;
  actorId: string;
  planId: PlanId;
  months: TermMonths;
  couponCode?: string | null;
}): Promise<{ invoice: BillingInvoice; checkout: CheckoutQuote }> {
  const checkout = await buildCheckoutQuote(input);
  if (checkout.debtCents > 0) {
    throw new BillingError(
      "DEBT_DUE",
      "Pay the unpaid months first, then start your new payment period.",
    );
  }
  const admin = createAdminClient();
  const settings = await getBillingSettings();
  const { count: unpaid } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("team_id", input.teamId)
    .in("status", ["open", "payment_pending"]);
  if ((unpaid ?? 0) >= settings.maxUnpaidInvoices) {
    throw new BillingError(
      "TOO_MANY_UNPAID_INVOICES",
      "There are too many unpaid invoices. Pay or cancel one before creating another.",
    );
  }
  const expiresAt = new Date(
    Date.now() + settings.invoiceExpiryDays * 24 * 60 * 60 * 1000,
  );
  const description = `${checkout.planName} plan, ${checkout.termLabel}`;
  const { data, error } = await admin.rpc("billing_create_invoice", {
    p_team: input.teamId,
    p_kind: checkout.kind,
    p_plan: checkout.planId,
    p_months: checkout.months,
    p_currency: checkout.chargeCurrency,
    p_exchange_rate: checkout.exchangeRate,
    p_subtotal_cents: checkout.chargeSubtotalCents,
    p_discount_cents: checkout.chargeDiscountCents,
    p_tax_cents: checkout.chargeTaxCents,
    p_total_cents: checkout.chargeTotalCents,
    p_coverage_start: checkout.coverageStart,
    p_coverage_end: checkout.coverageEnd,
    p_due_at: new Date().toISOString(),
    p_expires_at: expiresAt.toISOString(),
    p_coupon_code: checkout.quote.couponCode,
    p_description: description,
    p_notes: null,
    p_created_by: input.actorId,
    p_metadata: {
      source: "checkout",
      quote: checkout.quote,
      plan_name: checkout.planName,
      term_label: checkout.termLabel,
      debt_cents_at_creation: checkout.debtCents,
    },
  });
  if (error) throw new BillingError("INVOICE_CREATE_FAILED", error.message);
  const invoiceId = string((data as Row)?.id);
  const result = await getInvoice(input.teamId, invoiceId);
  if (!result) throw new BillingError("INVOICE_CREATE_FAILED", "Invoice was not saved.");
  return { invoice: result.invoice, checkout };
}

export async function startInvoicePayment(input: {
  teamId: string;
  invoiceId: string;
  actorId: string;
  email?: string | null;
  name?: string | null;
}): Promise<{ redirectUrl: string; merchantReference: string }> {
  const admin = createAdminClient();
  const invoice = await getInvoice(input.teamId, input.invoiceId);
  if (!invoice) throw new BillingError("NOT_FOUND", "That invoice was not found.");
  const raw = invoice.raw as Row;
  if (!["open", "payment_pending"].includes(string(raw.status))) {
    throw new BillingError("INVOICE_NOT_OPEN", "That invoice can no longer be paid.");
  }
  if (raw.expires_at && new Date(string(raw.expires_at)).getTime() <= Date.now()) {
    throw new BillingError("INVOICE_EXPIRED", "That invoice has expired.");
  }
  const settings = await getBillingSettings();
  const provider = getPaymentProvider(settings.pesapalIpnId);
  const merchantReference = `${string(raw.number).replace(/[^A-Za-z0-9]/g, "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const attempt = await admin
    .from("payment_attempts")
    .insert({
      team_id: input.teamId,
      invoice_id: input.invoiceId,
      provider: provider.name(),
      merchant_reference: merchantReference,
      amount_cents: number(raw.total_cents),
      currency: string(raw.currency),
      status: "pending",
      created_by: input.actorId,
      metadata: { invoice_number: string(raw.number) },
    })
    .select("id")
    .single();
  if (attempt.error) {
    throw new BillingError("PAYMENT_ATTEMPT_FAILED", attempt.error.message);
  }

  try {
    const order = await provider.submitOrder({
      merchantReference,
      amountCents: number(raw.total_cents),
      currency: string(raw.currency),
      description: `Get-On ${string(raw.kind)} payment`,
      callbackUrl:
        process.env.PESAPAL_CALLBACK_URL ||
        `${appOrigin()}/api/billing/pesapal/callback`,
      cancellationUrl: `${appOrigin()}/dashboard/plan?payment=cancelled`,
      email: input.email ?? nullableString(raw.billing_email),
      name: input.name ?? nullableString(raw.billing_name),
    });
    await Promise.all([
      admin
        .from("payment_attempts")
        .update({
          status: "redirected",
          provider_reference: order.orderTrackingId,
          redirect_url: order.redirectUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", attempt.data.id),
      admin
        .from("invoices")
        .update({ status: "payment_pending", updated_at: new Date().toISOString() })
        .eq("id", input.invoiceId)
        .in("status", ["open", "payment_pending"]),
    ]);
    return { redirectUrl: order.redirectUrl, merchantReference };
  } catch (error) {
    await admin
      .from("payment_attempts")
      .update({
        status: "failed",
        error_code: error instanceof PaymentProviderError ? error.code : "PAYMENT_FAILED",
        error_message: error instanceof Error ? error.message.slice(0, 300) : "Payment failed.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", attempt.data.id);
    throw error;
  }
}

export async function confirmProviderTransaction(
  transaction: ProviderTransaction,
  eventKey: string,
): Promise<Row> {
  const admin = createAdminClient();
  const provider = getPaymentProvider();
  const { data, error } = await admin.rpc("billing_confirm_payment", {
    p_provider: provider.name(),
    p_provider_reference: transaction.orderTrackingId,
    p_merchant_reference: transaction.merchantReference,
    p_amount_cents: transaction.amountCents,
    p_currency: transaction.currency,
    p_method: transaction.method,
    p_confirmation_code: transaction.confirmationCode,
    p_paid_at: transaction.paidAt ?? new Date().toISOString(),
    p_event_key: eventKey,
    p_event_type: "IPNCHANGE",
    p_summary: {
      status_code: transaction.statusCode,
      description: transaction.description,
      raw_status: transaction.rawStatus,
    },
  });
  if (error) throw new BillingError("PAYMENT_CONFIRM_FAILED", error.message);
  const result = (data ?? {}) as Row;
  if (result.status === "confirmed" && result.invoice_id) {
    await notifyPaymentConfirmed(String(result.invoice_id)).catch(() => undefined);
  }
  return result;
}

export async function handleProviderStatus(orderTrackingId: string): Promise<Row> {
  const provider = getPaymentProvider();
  const transaction = await provider.getTransactionStatus(orderTrackingId);
  const eventKey = `status:${transaction.orderTrackingId}`;
  const admin = createAdminClient();

  if (transaction.status === "completed") {
    return confirmProviderTransaction(transaction, eventKey);
  }

  const { data: attempt } = await admin
    .from("payment_attempts")
    .select("id, team_id, invoice_id, merchant_reference, status")
    .eq("provider_reference", orderTrackingId)
    .maybeSingle();

  if (attempt) {
    await admin
      .from("payment_attempts")
      .update({
        status:
          transaction.status === "failed" || transaction.status === "invalid"
            ? "failed"
            : "cancelled",
        error_code: transaction.rawStatus || String(transaction.status),
        updated_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    await admin
      .from("invoices")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", attempt.invoice_id)
      .eq("status", "payment_pending");
    await admin.from("payment_events").insert({
      provider: provider.name(),
      event_key: eventKey,
      event_type: "IPNCHANGE",
      order_tracking_id: orderTrackingId,
      merchant_reference: attempt.merchant_reference,
      status_received: transaction.status,
      payload_summary: {
        status_code: transaction.statusCode,
        description: transaction.description,
      },
      processed_at: new Date().toISOString(),
    });
    await notifyPaymentFailed(
      String(attempt.invoice_id),
      transaction.rawStatus || transaction.status,
    ).catch(() => undefined);
    if (transaction.status === "reversed") {
      await admin.from("billing_review_items").insert({
        team_id: attempt.team_id,
        invoice_id: attempt.invoice_id,
        kind: "payment_reversed",
        details: {
          provider_reference: orderTrackingId,
          merchant_reference: attempt.merchant_reference,
        },
      });
    }
  }

  return {
    status: transaction.status,
    order_tracking_id: orderTrackingId,
    merchant_reference: transaction.merchantReference,
  };
}

export async function completeFakePayment(input: {
  merchantReference: string;
  outcome: "completed" | "failed" | "reversed";
}): Promise<Row> {
  if (process.env.NODE_ENV === "production" || process.env.PAYMENT_PROVIDER === "pesapal") {
    throw new BillingError("NOT_ALLOWED", "The fake provider is not available.");
  }
  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("payment_attempts")
    .select("id, team_id, invoice_id, provider_reference, amount_cents, currency, status")
    .eq("merchant_reference", input.merchantReference)
    .maybeSingle();
  if (!attempt) throw new BillingError("NOT_FOUND", "That payment was not found.");
  if (input.outcome === "completed") {
    return confirmProviderTransaction(
      {
        orderTrackingId: string(attempt.provider_reference) || `fake-${input.merchantReference}`,
        merchantReference: input.merchantReference,
        amountCents: number(attempt.amount_cents),
        currency: string(attempt.currency),
        status: "completed",
        statusCode: 1,
        description: "Fake payment completed",
        method: "fake",
        confirmationCode: `FAKE-${input.merchantReference}`,
        paidAt: new Date().toISOString(),
        rawStatus: "COMPLETED",
      },
      `fake:${input.merchantReference}`,
    );
  }

  const status = input.outcome === "failed" ? "failed" : "cancelled";
  await Promise.all([
    admin
      .from("payment_attempts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", attempt.id),
    admin
      .from("invoices")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", attempt.invoice_id)
      .eq("status", "payment_pending"),
    admin.from("payment_events").insert({
      provider: "fake",
      event_key: `fake:${input.merchantReference}:${input.outcome}`,
      event_type: "IPNCHANGE",
      order_tracking_id: string(attempt.provider_reference),
      merchant_reference: input.merchantReference,
      status_received: input.outcome,
      processed_at: new Date().toISOString(),
    }),
  ]);
  await notifyPaymentFailed(
    String(attempt.invoice_id),
    input.outcome,
  ).catch(() => undefined);
  if (input.outcome === "reversed") {
    await admin.from("billing_review_items").insert({
      team_id: attempt.team_id,
      invoice_id: attempt.invoice_id,
      kind: "payment_reversed",
      details: { merchant_reference: input.merchantReference },
    });
  }
  return { status: input.outcome, merchant_reference: input.merchantReference };
}

export { formatMoney };

export function invoiceIsOpen(invoice: BillingInvoice): boolean {
  return (
    (invoice.status === "open" || invoice.status === "payment_pending") &&
    (!invoice.expiresAt || new Date(invoice.expiresAt).getTime() > Date.now())
  );
}

export function accessLabel(access: BillingAccess): string {
  if (access.status === "active") return "Active";
  if (access.status === "grace") return "Grace period";
  if (access.status === "lapsed") return "Lapsed";
  return "Free";
}

export async function refundPayment(input: {
  teamId: string;
  paymentId: string;
  amountCents: number;
  reason: string;
  actorId: string | null;
  approvalId?: string | null;
}): Promise<{ status: string; message: string }> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select(
      "id, team_id, invoice_id, provider, provider_reference, amount_cents, currency, status, confirmation_code",
    )
    .eq("id", input.paymentId)
    .eq("team_id", input.teamId)
    .maybeSingle();
  if (!payment) throw new BillingError("NOT_FOUND", "That payment was not found.");
  if (!["confirmed", "partly_refunded"].includes(String(payment.status))) {
    throw new BillingError("PAYMENT_NOT_REFUNDABLE", "That payment cannot be refunded.");
  }
  if (input.amountCents <= 0 || input.reason.trim().length < 3) {
    throw new BillingError("BAD_REFUND", "Enter an amount and a short reason.");
  }
  const { data: prior } = await admin
    .from("refunds")
    .select("amount_cents")
    .eq("payment_id", input.paymentId)
    .in("status", ["requested", "processed"]);
  const already = (prior ?? []).reduce((sum, row) => sum + number(row.amount_cents), 0);
  const remaining = number(payment.amount_cents) - already;
  if (input.amountCents > remaining) {
    throw new BillingError("REFUND_TOO_LARGE", "That is more than the unrefunded amount.");
  }

  const { data: refund, error: insertError } = await admin
    .from("refunds")
    .insert({
      team_id: input.teamId,
      invoice_id: payment.invoice_id,
      payment_id: input.paymentId,
      amount_cents: input.amountCents,
      currency: payment.currency,
      reason: input.reason.trim(),
      status: "requested",
      created_by: input.actorId,
      approval_id: input.approvalId ?? null,
    })
    .select("id")
    .single();
  if (insertError) throw new BillingError("REFUND_FAILED", insertError.message);

  const provider = getPaymentProvider();
  let result;
  try {
    result = await provider.refund({
      orderTrackingId: String(payment.provider_reference),
      confirmationCode: String(payment.confirmation_code ?? payment.provider_reference),
      amountCents: input.amountCents,
      currency: String(payment.currency),
      reason: input.reason.trim(),
    });
  } catch (error) {
    result = {
      providerReference: "",
      status: "failed" as const,
      message: error instanceof Error ? error.message : "Refund failed.",
    };
  }

  const status = result.status === "processed" ? "processed" : result.status === "failed" ? "failed" : "requested";
  await admin
    .from("refunds")
    .update({
      status,
      provider_reference: result.providerReference || null,
      processed_at: status === "processed" ? new Date().toISOString() : null,
    })
    .eq("id", refund.id);

  if (status === "processed") {
    const { data: refunds } = await admin
      .from("refunds")
      .select("amount_cents")
      .eq("payment_id", input.paymentId)
      .eq("status", "processed");
    const totalRefunded = (refunds ?? []).reduce(
      (sum, row) => sum + number(row.amount_cents),
      0,
    );
    await admin
      .from("payments")
      .update({
        status:
          totalRefunded >= number(payment.amount_cents)
            ? "refunded"
            : "partly_refunded",
      })
      .eq("id", input.paymentId);
    await admin
      .from("invoices")
      .update({
        status:
          totalRefunded >= number(payment.amount_cents)
            ? "refunded"
            : "partly_refunded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.invoice_id);
    await admin.from("billing_ledger").insert({
      team_id: input.teamId,
      invoice_id: payment.invoice_id,
      payment_id: input.paymentId,
      kind: "refund_processed",
      amount_cents: -input.amountCents,
      currency: String(payment.currency),
      description: "Refund processed",
      metadata: {
        reason: input.reason.trim(),
        provider_reference: result.providerReference,
        ...(input.approvalId ? { approval_id: input.approvalId } : {}),
      },
      created_by: input.actorId,
    });
    const { data: invoice } = await admin
      .from("invoices")
      .select("kind")
      .eq("id", payment.invoice_id)
      .maybeSingle();
    if (invoice?.kind === "debt") {
      const { data: billing } = await admin
        .from("team_billing")
        .select("debt_paid_cents")
        .eq("team_id", input.teamId)
        .maybeSingle();
      const nextPaid = Math.max(
        0,
        Number(billing?.debt_paid_cents ?? 0) - input.amountCents,
      );
      await admin
        .from("team_billing")
        .update({
          debt_paid_cents: nextPaid,
          updated_at: new Date().toISOString(),
        })
        .eq("team_id", input.teamId);
      await refreshTeamBilling(input.teamId);
    }
    await notifyRefund({
      teamId: input.teamId,
      invoiceId: String(payment.invoice_id),
      amountCents: input.amountCents,
      currency: String(payment.currency),
      status,
    }).catch(() => undefined);
  } else if (status === "failed") {
    await admin.from("billing_review_items").insert({
      team_id: input.teamId,
      invoice_id: payment.invoice_id,
      kind: "refund_failed",
      details: {
        payment_id: input.paymentId,
        amount_cents: input.amountCents,
        message: result.message,
      },
    });
  }

  return { status, message: result.message };
}
