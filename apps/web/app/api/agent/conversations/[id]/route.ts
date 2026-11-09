import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseAssistant, getAgentActor } from "@/lib/agent/auth";
import {
  getAgentBalance,
  getAgentConversation,
  listAgentMessages,
} from "@/lib/agent/conversations";
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
    const [messages, balance] = await Promise.all([
      listAgentMessages(admin, conversation.id),
      getAgentBalance(admin, actor.teamId),
    ]);
    return NextResponse.json({ conversation, messages, balance });
  } catch (error) {
    console.error("[agent] could not load conversation", error);
    return NextResponse.json(
      { error: "We could not load that chat." },
      { status: 500 },
    );
  }
}
