import { createAdminClient } from "@/lib/supabase/admin";
import { logTeamActivity } from "@/lib/activity/log";

export async function logActivity(params: {
  projectId: string;
  actorUserId?: string | null;
  event: string;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    const { data: project } = await admin
      .from("projects")
      .select("id, name, team_id")
      .eq("id", params.projectId)
      .maybeSingle();
    if (!project) return;
    await logTeamActivity({
      teamId: project.team_id,
      actor: { userId: params.actorUserId ?? null },
      event: params.event,
      summary: params.summary,
      project: { id: project.id, name: project.name },
      meta: params.meta,
    });
  } catch {
    // Activity logging must never block the user's action.
  }
}
