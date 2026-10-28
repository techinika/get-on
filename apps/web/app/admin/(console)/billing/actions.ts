"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBillingCoupon,
  createBillingGrant,
  requireStaffAction,
  resolveBillingReview,
  revokeBillingGrant,
  saveBillingSettings as saveBillingSettingsRpc,
  saveBillingTerm as saveBillingTermRpc,
  toggleBillingCoupon,
  voidBillingInvoice,
} from "@/lib/admin";
import { BillingError, refundPayment } from "@/lib/billing/service";

function fail(message: string): never {
  redirect(`/admin/billing?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  redirect(`/admin/billing?saved=${encodeURIComponent(message)}`);
}

function value(formData: FormData, key: string): string {
  const found = formData.get(key);
  return typeof found === "string" ? found.trim() : "";
}

function int(formData: FormData, key: string, fallback = 0): number {
  const parsed = Number.parseInt(value(formData, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (text.includes("COUPON_EXISTS")) return "That code already exists.";
  if (text.includes("PAID_INVOICE_IMMUTABLE")) return "Paid invoices cannot be cancelled.";
  if (text.includes("INVALID_")) return "Check the values and try again.";
  return "We could not save that change.";
}

export async function saveBillingSettings(formData: FormData) {
  await requireStaffAction("billing.price.manage");
  const currency = value(formData, "default_currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail("Use a three-letter currency code.");
  const reminderDays = value(formData, "reminder_days")
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part >= 0 && part <= 365);

  try {
    await saveBillingSettingsRpc({
      currency,
      graceDays: int(formData, "grace_days", 7),
      reminderDays: reminderDays.length ? reminderDays : [30, 7, 1],
      invoiceExpiryDays: int(formData, "invoice_expiry_days", 14),
      maxUnpaidInvoices: int(formData, "max_unpaid_invoices", 3),
      taxRateBps: int(formData, "tax_rate_bps", 0),
      pesapalIpnId: value(formData, "pesapal_ipn_id") || null,
    });
  } catch (error) {
    fail(message(error));
  }
  revalidatePath("/admin/billing");
  done("Billing settings saved.");
}

export async function saveBillingTerm(formData: FormData) {
  await requireStaffAction("billing.price.manage");
  const months = int(formData, "months");
  if (![1, 6, 12, 24, 36, 48, 60].includes(months)) fail("Choose a valid term.");
  try {
    await saveBillingTermRpc({
      months,
      discountBps: int(formData, "discount_bps"),
      label: value(formData, "label") || `${months} months`,
      active: bool(formData, "active"),
    });
  } catch (error) {
    fail(message(error));
  }
  revalidatePath("/admin/billing");
  done("Payment period saved.");
}

export async function createCoupon(formData: FormData) {
  await requireStaffAction("billing.coupon.create");
  const code = value(formData, "code").toUpperCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) fail("Use 2 to 40 letters, numbers, - or _.");
  const percent = int(formData, "percent_off_bps");
  const amount = int(formData, "amount_off_cents");
  if ((percent > 0) === (amount > 0)) fail("Choose a percentage or a fixed amount, not both.");
  if (percent < 0 || percent > 10000 || amount < 0) fail("Check the discount value.");
  const planIds = value(formData, "plan_ids")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  try {
    await createBillingCoupon({
      code,
      percentOffBps: percent,
      amountOffCents: amount,
      planIds,
      minMonths: int(formData, "min_months"),
      firstPurchaseOnly: bool(formData, "first_purchase_only"),
      startsAt: value(formData, "starts_at") || null,
      endsAt: value(formData, "ends_at") || null,
      maxRedemptions: int(formData, "max_redemptions"),
      perTeamLimit: int(formData, "per_team_limit"),
    });
  } catch (error) {
    fail(message(error));
  }
  revalidatePath("/admin/billing");
  done("Discount code created.");
}

export async function toggleCoupon(formData: FormData) {
  await requireStaffAction("billing.coupon.create");
  const id = value(formData, "id");
  const active = bool(formData, "active");
  try {
    await toggleBillingCoupon(id, active);
  } catch (error) {
    fail(message(error));
  }
  revalidatePath("/admin/billing");
  done(active ? "Discount code turned on." : "Discount code turned off.");
}

export async function createGrant(formData: FormData) {
  await requireStaffAction("access.free.direct");
  const teamId = value(formData, "team_id");
  const planId = value(formData, "plan_id");
  const startsAt = value(formData, "starts_at") || new Date().toISOString();
  const endsAt = value(formData, "ends_at") || null;
  const note = value(formData, "note");
  if (!teamId || !planId) fail("Choose a team and plan.");
  if (note.length < 3) fail("Add a short reason.");

  try {
    await createBillingGrant({
      teamId,
      planId,
      startsAt,
      endsAt,
      note,
    });
  } catch (error) {
    fail(message(error));
  }
  revalidatePath("/admin/billing");
  done("Plan grant added.");
}

export async function revokeGrant(formData: FormData) {
  await requireStaffAction("access.free.direct");
  const id = value(formData, "id");
  try {
    await revokeBillingGrant(id);
  } catch (error) {
    fail(message(error));
  }
  revalidatePath("/admin/billing");
  done("Plan grant removed.");
}

export async function voidInvoice(formData: FormData) {
  await requireStaffAction("billing.invoice.void.direct");
  const id = value(formData, "id");
  const reason = value(formData, "reason");
  if (reason.length < 3) fail("Add a short reason.");
  try {
    await voidBillingInvoice(id, reason);
  } catch (error) {
    fail(message(error));
  }
  revalidatePath("/admin/billing");
  done("Invoice cancelled.");
}

export async function resolveReviewItem(formData: FormData) {
  await requireStaffAction("billing.payment_status");
  const id = value(formData, "id");
  try {
    await resolveBillingReview(id);
  } catch (error) {
    fail(message(error));
  }
  revalidatePath("/admin/billing");
  done("Review item closed.");
}

export async function refundPaymentAction(formData: FormData) {
  await requireStaffAction("billing.refund.direct");
  const teamId = value(formData, "team_id");
  const paymentId = value(formData, "payment_id");
  const amountCents = int(formData, "amount_cents");
  const reason = value(formData, "reason");
  try {
    await refundPayment({
      teamId,
      paymentId,
      amountCents,
      reason,
      actorId: null,
    });
  } catch (error) {
    if (error instanceof BillingError) fail(error.message);
    fail("We could not process that refund.");
  }
  revalidatePath("/admin/billing");
  done("Refund recorded.");
}
