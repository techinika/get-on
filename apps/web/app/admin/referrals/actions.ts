"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/admin";
import { getShellData } from "@/lib/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminReferralResult = { ok: boolean; error?: string };

async function requireAdmin(): Promise<string> {
  const data = await getShellData();
  if (!data || !isAdminEmail(data.user.email)) throw new Error("NOT_FOUND");
  return data.user.email;
}

async function audit(email: string, action: string, reason: string, metadata: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    admin_email: email,
    action,
    reason,
    metadata,
  });
}

export async function updateReferralSettings(formData: FormData): Promise<AdminReferralResult> {
  const email = await requireAdmin();
  const admin = createAdminClient();
  const enabled = formData.get("enabled") === "on";
  const qualifyHours = Math.max(1, Math.min(720, Number(formData.get("qualify_hours") ?? 24)));
  const monthlyCap = Math.max(1, Math.min(10000, Number(formData.get("monthly_cap") ?? 50)));
  const bonus = Math.max(0, Math.min(1000, Number(formData.get("referred_bonus_credits") ?? 10)));
  const velocity = Math.max(1, Math.min(1000, Number(formData.get("velocity_hold_per_day") ?? 5)));

  const { error } = await admin.from("referral_settings").upsert({
    id: 1,
    enabled,
    qualify_hours: qualifyHours,
    monthly_cap: monthlyCap,
    referred_bonus_credits: bonus,
    velocity_hold_per_day: velocity,
  });
  if (error) return { ok: false, error: "We could not save those settings." };
  await audit(email, "referral.settings_changed", "Referral settings updated", {
    enabled, qualifyHours, monthlyCap, bonus, velocity,
  });
  revalidatePath("/admin/referrals");
  return { ok: true };
}

export async function setReferralStatus(formData: FormData): Promise<AdminReferralResult> {
  const email = await requireAdmin();
  const id = String(formData.get("referral_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id || !["signed_up", "verified", "published", "held", "rejected", "revoked"].includes(status)) {
    return { ok: false, error: "Choose a valid status." };
  }
  if (status === "rejected" || status === "revoked" || status === "held") {
    if (reason.length < 3) return { ok: false, error: "Add a short reason." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("referrals")
    .update({ status, reason: reason || null, reviewed_by: null })
    .eq("id", id);
  if (error) return { ok: false, error: "We could not update that referral." };
  if (status === "published") {
    await admin
      .from("referrals")
      .update({ published_at: new Date().toISOString() })
      .eq("id", id)
      .is("published_at", null);
  }
  await audit(email, "referral.status_changed", reason || "Referral status changed", { referralId: id, status });
  revalidatePath("/admin/referrals");
  return { ok: true };
}
