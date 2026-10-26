import { createAdminClient } from "@/lib/supabase/admin";
import { activityEvent, type ActivityCategory } from "@get-on/activity";

export type ActivityActor = {
  userId: string | null;
  name?: string;
  role?: string | null;
  kind?: "user" | "system" | "support";
};

export type LogTeamActivityInput = {
  teamId: string;
  actor: ActivityActor;
  event: string;
  category?: ActivityCategory;
  summary?: string;
  project?: { id: string; name: string } | null;
  target?: { type?: string | null; id?: string | null; name?: string | null } | null;
  meta?: Record<string, unknown>;
  coalesceKey?: string;
  windowSeconds?: number;
  client?: string | null;
};

export async function logTeamActivity(input: LogTeamActivityInput): Promise<void> {
  try {
    const admin = createAdminClient();
    let name = input.actor.name;
    let role = input.actor.role ?? null;

    if (input.actor.userId && (!name || !role)) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", input.actor.userId)
        .maybeSingle();
      name = name || profile?.full_name || profile?.email || "Former member";
      if (!role) {
        const { data: member } = await admin
          .from("team_members")
          .select("role")
          .eq("team_id", input.teamId)
          .eq("user_id", input.actor.userId)
          .maybeSingle();
        role = member?.role ?? null;
      }
    }

    let projectName = input.project?.name ?? null;
    const projectId = input.project?.id ?? null;
    if (projectId && !projectName) {
      const { data: project } = await admin
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle();
      projectName = project?.name ?? null;
    }

    const catalogEvent = activityEvent(input.event);
    const category = input.category ?? catalogEvent?.category ?? "website";
    const summary = (input.summary ?? catalogEvent?.label ?? "Team activity").slice(0, 240);
    const windowSeconds =
      input.windowSeconds ?? catalogEvent?.coalesceWindowSeconds ?? 0;

    await admin.rpc("log_team_activity", {
      p_team: input.teamId,
      p_actor_user_id: input.actor.userId,
      p_actor_name: name || (input.actor.kind === "system" ? "Get-On" : "Get-On support"),
      p_actor_role: role,
      p_actor_kind: input.actor.kind ?? "user",
      p_category: category,
      p_event: input.event,
      p_summary: summary,
      p_project_id: projectId,
      p_project_name: projectName,
      p_target_type: input.target?.type ?? null,
      p_target_id: input.target?.id ?? null,
      p_target_name: input.target?.name ?? null,
      p_coalesce_key: input.coalesceKey ?? null,
      p_meta: input.meta ?? {},
      p_client: input.client ?? null,
      p_window_seconds: windowSeconds,
    });
  } catch (error) {
    console.error("team activity log failed", error);
  }
}
