"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { getShellData } from "@/lib/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
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

async function requireAdmin(): Promise<void> {
  const data = await getShellData();
  if (!data || !isAdminEmail(data.user.email)) throw new Error("NOT_FOUND");
}

export async function saveBillingSettings(formData: FormData) {
  await requireAdmin();
  const currency = value(formData, "default_currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail("Use a three-letter currency code.");
  const reminderDays = value(formData, "reminder_days")
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part >= 0 && part <= 365);
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_settings")
    .update({
      default_currency: currency,
      grace_days: Math.min(365, Math.max(0, int(formData, "grace_days", 7))),
      reminder_days: reminderDays.length ? reminderDays : [30, 7, 1],
      invoice_expiry_days: Math.min(365, Math.max(1, int(formData, "invoice_expiry_days", 14))),
      max_unpaid_invoices: Math.min(50, Math.max(1, int(formData, "max_unpaid_invoices", 3))),
      tax_rate_bps: Math.min(10000, Math.max(0, int(formData, "tax_rate_bps", 0))),
      pesapal_ipn_id: value(formData, "pesapal_ipn_id") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) fail("We could not save those settings.");
  revalidatePath("/admin/billing");
  done("Billing settings saved.");
}

export async function saveBillingTerm(formData: FormData) {
  await requireAdmin();
  const months = int(formData, "months");
  if (![1, 6, 12, 24, 36, 48, 60].includes(months)) fail("Choose a valid term.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_terms")
    .update({
      discount_bps: Math.min(10000, Math.max(0, int(formData, "discount_bps"))),
      label: value(formData, "label") || `${months} months`,
      active: bool(formData, "active"),
    })
    .eq("months", months);
  if (error) fail("We could not save that term.");
  revalidatePath("/admin/billing");
  done("Payment period saved.");
}

export async function createCoupon(formData: FormData) {
  await requireAdmin();
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
  const admin = createAdminClient();
  const { error } = await admin.from("coupons").insert({
    code,
    active: true,
    percent_off_bps: percent > 0 ? percent : null,
    amount_off_cents: amount > 0 ? amount : null,
    plan_ids: planIds.length ? planIds : null,
    min_months: int(formData, "min_months") || null,
    first_purchase_only: bool(formData, "first_purchase_only"),
    starts_at: value(formData, "starts_at") || null,
    ends_at: value(formData, "ends_at") || null,
    max_redemptions: int(formData, "max_redemptions") || null,
    per_team_limit: int(formData, "per_team_limit") || null,
  });
  if (error) fail(error.message.includes("duplicate") ? "That code already exists." : "We could not create that code.");
  revalidatePath("/admin/billing");
  done("Discount code created.");
}

export async function toggleCoupon(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const active = bool(formData, "active");
  const admin = createAdminClient();
  const { error } = await admin.from("coupons").update({ active }).eq("id", id);
  if (error) fail("We could not change that code.");
  revalidatePath("/admin/billing");
  done(active ? "Discount code turned on." : "Discount code turned off.");
}

export async function createGrant(formData: FormData) {
  await requireAdmin();
  const teamId = value(formData, "team_id");
  const planId = value(formData, "plan_id");
  const startsAt = value(formData, "starts_at") || new Date().toISOString();
  const endsAt = value(formData, "ends_at") || null;
  const note = value(formData, "note");
  if (!teamId || !planId) fail("Choose a team and plan.");
  if (note.length < 3) fail("Add a short reason.");
  const admin = createAdminClient();
  const { error } = await admin.from("access_grants").insert({
    team_id: teamId,
    plan_id: planId,
    starts_at: startsAt,
    ends_at: endsAt,
    source: "support",
    note,
  });
  if (error) fail("We could not add that grant.");
  revalidatePath("/admin/billing");
  done("Plan grant added.");
}

export async function revokeGrant(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const admin = createAdminClient();
  const { error } = await admin
    .from("access_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) fail("We could not remove that grant.");
  revalidatePath("/admin/billing");
  done("Plan grant removed.");
}

export async function voidInvoice(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const reason = value(formData, "reason");
  if (reason.length < 3) fail("Add a short reason.");
  const admin = createAdminClient();
  const { error } = await admin.rpc("billing_void_invoice", {
    p_invoice: id,
    p_reason: reason,
    p_actor: null,
  });
  if (error) fail(error.message.includes("PAID_INVOICE_IMMUTABLE") ? "Paid invoices cannot be cancelled." : "We could not cancel that invoice.");
  revalidatePath("/admin/billing");
  done("Invoice cancelled.");
}

export async function resolveReviewItem(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const admin = createAdminClient();
  const { error } = await admin
    .from("billing_review_items")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail("We could not close that item.");
  revalidatePath("/admin/billing");
  done("Review item closed.");
}

export async function refundPaymentAction(formData: FormData) {
  await requireAdmin();
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
