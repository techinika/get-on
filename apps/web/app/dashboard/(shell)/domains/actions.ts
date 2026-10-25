"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { asDomainError } from "@/lib/domains/errors";
import { DomainService } from "@/lib/domains/service";

export type TeamDomainResult = { ok: true } | { ok: false; error: string };

function canManage(role: string): boolean {
  return role === "owner" || role === "admin";
}

export async function attachDomainAction(
  domainId: string,
  projectId: string,
): Promise<TeamDomainResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canManage(current.team.role)) {
    return { ok: false, error: "Only owners and admins can change domains." };
  }

  const supabase = await createClient();
  const [{ data: project }, { data: domain }] = await Promise.all([
    supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("team_id", current.team.teamId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("domains")
      .select("id, project_id")
      .eq("id", domainId)
      .eq("team_id", current.team.teamId)
      .neq("status", "removed")
      .maybeSingle(),
  ]);
  if (!project || !domain) {
    return { ok: false, error: "We could not find that domain or website." };
  }
  if (domain.project_id) {
    return { ok: false, error: "That domain is already used by a website." };
  }

  try {
    await new DomainService({ supabase }).reassignDomain(domainId, projectId);
  } catch (error) {
    return { ok: false, error: asDomainError(error).message };
  }

  revalidatePath("/dashboard/domains");
  revalidatePath(`/dashboard/projects/${projectId}/settings/address`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}
