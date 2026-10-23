"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Renames the current team (owners and admins only). */
export async function updateTeamName(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2) {
    return { ok: false, error: "Please use at least 2 characters." };
  }
  if (name.length > 60) {
    return { ok: false, error: "Please use 60 characters or fewer." };
  }

  const current = await getCurrentTeam();
  if (!current) {
    return { ok: false, error: "Please sign in again." };
  }
  if (current.team.role !== "owner" && current.team.role !== "admin") {
    return { ok: false, error: "Only the owner and admins can rename this team." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ name })
    .eq("id", current.team.teamId)
    .eq("name", current.team.teamName);

  if (error) {
    return { ok: false, error: "We could not save that. Please try again." };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Invitations are not available yet, so this always explains that. */
export async function inviteMember(): Promise<ActionResult> {
  return { ok: false, error: "Invitations are coming soon." };
}
