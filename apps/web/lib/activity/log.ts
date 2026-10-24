import { createAdminClient } from "@/lib/supabase/admin";

export async function logActivity(params: {
  projectId: string;
  actorUserId?: string | null;
  event: string;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("project_activity").insert({
    project_id: params.projectId,
    actor_user_id: params.actorUserId ?? null,
    event: params.event,
    summary: params.summary,
    meta: params.meta ?? {},
  });
}
