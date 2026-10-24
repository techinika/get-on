"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { applyTemplateToProject, restoreTemplateSnapshot, type ApplyMode } from "@/lib/templates/apply";

export type TemplateActionResult =
  | { ok: true; homePageId: string; pages: number }
  | { ok: false; message: string };

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "We could not find that website.",
  THEME_FAILED: "We could not update the colours. Please try again.",
  PAGES_FAILED: "We could not update the pages. Please try again.",
  SETTINGS_FAILED: "The pages changed, but we could not save the design details.",
  NO_SNAPSHOT: "There is nothing to undo.",
  FORBIDDEN: "You do not have permission to change this website.",
};

export async function applyTemplateAction(
  projectId: string,
  slug: string,
  mode: ApplyMode,
): Promise<TemplateActionResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, message: MESSAGES.FORBIDDEN! };
  if (current.team.role === "viewer") return { ok: false, message: MESSAGES.FORBIDDEN! };

  const supabase = await createClient();
  const plan = planLimits(current.team.planId);
  const result = await applyTemplateToProject({
    supabase,
    projectId,
    teamId: current.team.teamId,
    slug,
    mode,
    maxPages: plan.maxPagesPerSite,
    appliedBy: current.user.id,
  });

  if (!result.ok) {
    return { ok: false, message: MESSAGES[result.error] ?? "Something went wrong. Please try again." };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/pages`);
  revalidatePath(`/dashboard/projects/${projectId}/templates`);
  return { ok: true, homePageId: result.homePageId, pages: result.pageCount };
}

export async function restoreTemplateAction(projectId: string): Promise<TemplateActionResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, message: MESSAGES.FORBIDDEN! };
  if (current.team.role === "viewer") return { ok: false, message: MESSAGES.FORBIDDEN! };

  const supabase = await createClient();
  const result = await restoreTemplateSnapshot({
    supabase,
    projectId,
    teamId: current.team.teamId,
  });

  if (!result.ok) {
    return { ok: false, message: MESSAGES[result.error] ?? "Something went wrong. Please try again." };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/pages`);
  revalidatePath(`/dashboard/projects/${projectId}/templates`);
  return { ok: true, homePageId: result.homePageId, pages: 0 };
}
