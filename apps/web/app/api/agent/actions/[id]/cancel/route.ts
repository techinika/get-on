import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseAssistant, getAgentActor } from "@/lib/agent/auth";
import { finishAgentRun } from "@/lib/agent/conversations";
import { getAssistantFeature } from "@/lib/agent/settings";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getAgentActor();
  if (!actor) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  if (!canUseAssistant(actor.role)) {
    return NextResponse.json(
      { error: "Ask an owner or admin to use the assistant." },
      { status: 403 },
    );
  }
  const feature = await getAssistantFeature();
  if (!feature.enabled) {
    return NextResponse.json({ error: "Assistant is off." }, { status: 503 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: action, error } = await admin
    .from("agent_pending_actions")
    .select("id, conversation_id, status, user_id, team_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !action) {
    return NextResponse.json({ error: "That action could not be found." }, { status: 404 });
  }
  if (action.user_id !== actor.userId || action.team_id !== actor.teamId) {
    return NextResponse.json({ error: "You do not have permission to cancel this action." }, { status: 403 });
  }
  if (action.status !== "pending") {
    return NextResponse.json({ error: "This action has already been resolved." }, { status: 409 });
  }

  await admin
    .from("agent_pending_actions")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", id);

  try {
    const { data: run } = await admin
      .from("agent_runs")
      .select("id")
      .eq("conversation_id", action.conversation_id)
      .eq("user_id", actor.userId)
      .eq("status", "running")
      .maybeSingle();
    if (run?.id) {
      await finishAgentRun(admin, String(run.id), { status: "cancelled" });
    }
  } catch {
    // Best effort.
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
