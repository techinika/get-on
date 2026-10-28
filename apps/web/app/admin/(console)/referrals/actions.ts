"use server";

import { revalidatePath } from "next/cache";
import {
  requireStaffAction,
  saveReferralSettings as saveReferralSettingsRpc,
  setReferralStatus as setReferralStatusRpc,
} from "@/lib/admin";

export type AdminReferralResult = { ok: boolean; error?: string };

function failed(error: unknown): AdminReferralResult {
  const text = error instanceof Error ? error.message : "";
  if (text.includes("REASON_REQUIRED")) return { ok: false, error: "Add a short reason." };
  if (text.includes("REFERRAL_NOT_FOUND")) {
    return { ok: false, error: "We could not find that referral." };
  }
  if (text.includes("INVALID_STATUS")) return { ok: false, error: "Choose a valid status." };
  return { ok: false, error: "We could not save that change." };
}

export async function updateReferralSettings(
  formData: FormData,
): Promise<AdminReferralResult> {
  await requireStaffAction("marketing.settings");
  const enabled = formData.get("enabled") === "on";
  const qualifyHours = Math.max(1, Math.min(720, Number(formData.get("qualify_hours") ?? 24)));
  const monthlyCap = Math.max(1, Math.min(10000, Number(formData.get("monthly_cap") ?? 50)));
  const bonus = Math.max(0, Math.min(1000, Number(formData.get("referred_bonus_credits") ?? 10)));
  const velocity = Math.max(1, Math.min(1000, Number(formData.get("velocity_hold_per_day") ?? 5)));

  try {
    await saveReferralSettingsRpc({
      enabled,
      qualifyHours,
      monthlyCap,
      bonusCredits: bonus,
      velocityHoldPerDay: velocity,
    });
  } catch (error) {
    return failed(error);
  }
  revalidatePath("/admin/referrals");
  return { ok: true };
}

export async function setReferralStatus(
  formData: FormData,
): Promise<AdminReferralResult> {
  await requireStaffAction("marketing.settings");
  const id = String(formData.get("referral_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id || !["signed_up", "verified", "published", "held", "rejected", "revoked"].includes(status)) {
    return { ok: false, error: "Choose a valid status." };
  }
  if ((status === "rejected" || status === "revoked" || status === "held") && reason.length < 3) {
    return { ok: false, error: "Add a short reason." };
  }

  try {
    await setReferralStatusRpc(id, status, reason || null);
  } catch (error) {
    return failed(error);
  }
  revalidatePath("/admin/referrals");
  return { ok: true };
}
