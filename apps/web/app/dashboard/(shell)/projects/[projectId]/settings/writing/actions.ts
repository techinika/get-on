"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { logActivity } from "@/lib/activity";
import { can } from "@/lib/permissions";
import { parseWritingStyle } from "./style";
import { parseDesignPrefsForm } from "@/lib/ai/design-prefs";

export type WritingStyleResult = { ok: true } | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

function canEdit(role: string) {
  return can(role as "owner" | "admin" | "editor" | "viewer", "page.edit");
}

async function findProject(
  supabase: Supabase,
  projectId: string,
  teamId: string,
) {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("team_id", teamId)
    .maybeSingle();
  return data;
}

export async function saveWritingStyle(
  projectId: string,
  formData: FormData,
): Promise<WritingStyleResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return {
      ok: false,
      error: "Only editors, admins and the owner can change the writing style.",
    };
  }

  const { tones, audience, wordsToUse, wordsToAvoid, businessFacts } =
    parseWritingStyle(formData);
  const designPrefs = parseDesignPrefsForm(formData);

  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const { data: settings } = await supabase
    .from("project_settings")
    .select("brand_voice")
    .eq("project_id", projectId)
    .maybeSingle();
  const existing =
    settings?.brand_voice && typeof settings.brand_voice === "object"
      ? (settings.brand_voice as Record<string, unknown>)
      : {};

  const brandVoice: Record<string, unknown> = { ...existing };
  if (tones.length > 0) brandVoice.tones = tones;
  else delete brandVoice.tones;
  if (audience) brandVoice.audience = audience;
  else delete brandVoice.audience;
  if (wordsToUse.length > 0) brandVoice.wordsToUse = wordsToUse;
  else delete brandVoice.wordsToUse;
  if (wordsToAvoid.length > 0) brandVoice.wordsToAvoid = wordsToAvoid;
  else delete brandVoice.wordsToAvoid;

  const { error } = await supabase.from("project_settings").upsert(
    {
      project_id: projectId,
      brand_voice: brandVoice,
      business_facts: businessFacts,
      design_prefs: designPrefs,
    },
    { onConflict: "project_id" },
  );
  if (error) {
    return { ok: false, error: "We could not save that. Please try again." };
  }

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "settings.writing_updated",
    summary: "Writing style was updated",
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/settings`, "layout");
  revalidatePath(`/dashboard/projects/${projectId}/settings/writing`);
  revalidatePath(`/dashboard/projects/${projectId}/settings/ai-history`);
  return { ok: true };
}
