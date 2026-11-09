import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseAssistant, getAgentActor } from "@/lib/agent/auth";
import {
  createAgentConversation,
  listAgentConversations,
  verifyAgentProject,
} from "@/lib/agent/conversations";
import { getAssistantFeature } from "@/lib/agent/settings";

const createSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
});

export async function GET() {
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

  try {
    const admin = createAdminClient();
    const conversations = await listAgentConversations(
      admin,
      actor.teamId,
      actor.userId,
    );
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("[agent] could not list conversations", error);
    return NextResponse.json(
      { error: "We could not load your chats." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That request is not valid." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const projectId = parsed.data.projectId ?? null;
    if (!(await verifyAgentProject(admin, actor.teamId, projectId))) {
      return NextResponse.json(
        { error: "That website could not be found." },
        { status: 404 },
      );
    }
    const conversation = await createAgentConversation(admin, {
      teamId: actor.teamId,
      userId: actor.userId,
      projectId,
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("[agent] could not create conversation", error);
    return NextResponse.json(
      { error: "We could not start a new chat." },
      { status: 500 },
    );
  }
}
