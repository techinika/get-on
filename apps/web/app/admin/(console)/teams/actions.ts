"use server";

import { revalidatePath } from "next/cache";
import { requireStaffAction, setTeamPlan as setTeamPlanRpc } from "@/lib/admin";

export type AdminTeamResult = { ok: boolean; error?: string };

export async function setTeamPlan(formData: FormData): Promise<AdminTeamResult> {
  await requireStaffAction("account.entitlements.rebuild");
  const teamId = String(formData.get("team_id") ?? "");
  const plan = String(formData.get("plan_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!teamId || !plan) return { ok: false, error: "Choose a plan." };
  if (note.length < 3) return { ok: false, error: "Add a short reason for the change." };

  try {
    await setTeamPlanRpc(teamId, plan, note);
  } catch {
    return { ok: false, error: "We could not change that plan." };
  }
  revalidatePath("/admin/teams");
  return { ok: true };
}
