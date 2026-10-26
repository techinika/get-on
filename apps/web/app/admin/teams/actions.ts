"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/admin";
import { getShellData } from "@/lib/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminTeamResult = { ok: boolean; error?: string };

async function adminEmail(): Promise<string> {
  const data = await getShellData();
  if (!data || !isAdminEmail(data.user.email)) throw new Error("NOT_FOUND");
  return data.user.email;
}

export async function setTeamPlan(formData: FormData): Promise<AdminTeamResult> {
  const email = await adminEmail();
  const teamId = String(formData.get("team_id") ?? "");
  const plan = String(formData.get("plan_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!teamId || !plan) return { ok: false, error: "Choose a plan." };
  if (note.length < 3) return { ok: false, error: "Add a short reason for the change." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_team_plan_manual", {
    p_team: teamId,
    p_plan: plan,
    p_note: note,
    p_admin_email: email,
  });
  if (error) return { ok: false, error: "We could not change that plan." };
  revalidatePath("/admin/teams");
  return { ok: true };
}
