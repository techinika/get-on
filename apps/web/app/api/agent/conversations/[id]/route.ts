import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseAssistant, getAgentActor } from "@/lib/agent/auth";
import {
  getAgentBalance,
  getAgentConversation,
  listAgentMessages,
} from "@/lib/agent/conversations";
import { buildAgentNextSteps } from "@/lib/agent/loop";
import { getAssistantFeature } from "@/lib/agent/settings";

export async function GET(
  _request: Request,
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
  try {
    const admin = createAdminClient();
    const conversation = await getAgentConversation(
      admin,
      id,
      actor.teamId,
      actor.userId,
    );
    if (!conversation) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }
    const nowIso = new Date().toISOString();
    const [messages, balance, pendingRes] = await Promise.all([
      listAgentMessages(admin, conversation.id),
      getAgentBalance(admin, actor.teamId),
      admin
        .from("agent_pending_actions")
        .select("id, tool_name, preview, estimated_credits, expires_at")
        .eq("conversation_id", conversation.id)
        .eq("user_id", actor.userId)
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const pendingRow = pendingRes?.data as
      | {
          id: string;
          tool_name: string;
          preview?: { name?: string; address?: string } | null;
          estimated_credits: number | null;
          expires_at: string;
        }
      | null
      | undefined;

    const pendingConfirmation = pendingRow
      ? {
          id: pendingRow.id,
          tool: pendingRow.tool_name,
          summary:
            pendingRow.preview?.name && pendingRow.preview?.address
              ? `Create the website “${pendingRow.preview.name}” at ${pendingRow.preview.address}.get-on.tech`
              : "Confirm this website action",
          estimatedCredits: Number(pendingRow.estimated_credits ?? 0),
          expiresAt: pendingRow.expires_at,
        }
      : null;

    const nextSteps = pendingConfirmation
      ? []
      : messages.length > 0
        ? buildAgentNextSteps({ projectId: conversation.projectId })
        : [];

    return NextResponse.json({
      conversation,
      messages,
      balance,
      pendingConfirmation,
      nextSteps,
    });
  } catch (error) {
    console.error("[agent] could not load conversation", error);
    return NextResponse.json(
      { error: "We could not load that chat." },
      { status: 500 },
    );
  }
}
