"use server";

import { parseTermMonths } from "@get-on/billing";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BillingError,
  createDebtInvoice,
  createInvoiceForCheckout,
  getInvoice,
  requireBillingAction,
  startInvoicePayment,
} from "@/lib/billing/service";
import { getShellData } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/plans";

function fail(message: string): never {
  redirect(`/dashboard/plan?error=${encodeURIComponent(message)}`);
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readPlan(value: string): PlanId {
  if (value === "basic" || value === "pro" || value === "enterprise") return value;
  return "free";
}

export async function checkoutAction(formData: FormData) {
  const data = await getShellData();
  if (!data) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const planId = readPlan(readString(formData, "plan"));
  const months = parseTermMonths(readString(formData, "months"));
  if (planId === "free" || !months) fail("Choose a plan and a payment period.");

  try {
    await requireBillingAction(data.currentTeam.id, user.id, "billing.pay");
    const { invoice } = await createInvoiceForCheckout({
      teamId: data.currentTeam.id,
      actorId: user.id,
      planId,
      months,
      couponCode: readString(formData, "coupon") || null,
    });
    const payment = await startInvoicePayment({
      teamId: data.currentTeam.id,
      invoiceId: invoice.id,
      actorId: user.id,
      email: user.email,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    });
    redirect(payment.redirectUrl);
  } catch (error) {
    if (error instanceof BillingError) fail(error.message);
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    fail("We could not start the payment. Please try again.");
  }
}

export async function payInvoiceAction(formData: FormData) {
  const data = await getShellData();
  if (!data) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const invoiceId = readString(formData, "invoiceId");
  if (!invoiceId) fail("Choose an invoice to pay.");

  try {
    await requireBillingAction(data.currentTeam.id, user.id, "billing.pay");
    const invoice = await getInvoice(data.currentTeam.id, invoiceId);
    if (!invoice) fail("That invoice was not found.");
    const payment = await startInvoicePayment({
      teamId: data.currentTeam.id,
      invoiceId,
      actorId: user.id,
      email: user.email,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    });
    redirect(payment.redirectUrl);
  } catch (error) {
    if (error instanceof BillingError) fail(error.message);
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    fail("We could not start the payment. Please try again.");
  }
}

export async function payDebtAction() {
  const data = await getShellData();
  if (!data) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    await requireBillingAction(data.currentTeam.id, user.id, "billing.pay");
    const invoice = await createDebtInvoice({
      teamId: data.currentTeam.id,
      actorId: user.id,
    });
    const payment = await startInvoicePayment({
      teamId: data.currentTeam.id,
      invoiceId: invoice.id,
      actorId: user.id,
      email: user.email,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    });
    redirect(payment.redirectUrl);
  } catch (error) {
    if (error instanceof BillingError) fail(error.message);
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    fail("We could not start the payment. Please try again.");
  }
}

export async function refreshBillingAction() {
  const data = await getShellData();
  if (!data) redirect("/login");
  revalidatePath("/dashboard/plan");
  redirect("/dashboard/plan");
}
