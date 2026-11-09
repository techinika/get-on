import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseAssistant, getAgentActor } from "@/lib/agent/auth";
import { executeSiteDraft } from "@/lib/agent/site-draft";
import { createSiteFromBrief, type SiteBrief } from "@/lib/agent/site-generation";
import { appendAgentMessage, finishAgentRun } from "@/lib/agent/conversations";
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
    .select("id, conversation_id, tool_name, arguments, status, expires_at, user_id, team_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !action) {
    return NextResponse.json({ error: "That action could not be found." }, { status: 404 });
  }
  if (action.user_id !== actor.userId || action.team_id !== actor.teamId) {
    return NextResponse.json({ error: "You do not have permission to confirm this action." }, { status: 403 });
  }
  if (action.status !== "pending") {
    return NextResponse.json({ error: "This action has already been resolved." }, { status: 409 });
  }
  if (new Date(action.expires_at) < new Date()) {
    await admin.from("agent_pending_actions").update({ status: "expired" }).eq("id", id);
    return NextResponse.json({ error: "This action has expired. Start over." }, { status: 409 });
  }

  const toolName = action.tool_name;
  if (toolName === "create_site") {
    const result = await executeSiteDraft(admin, id, actor);
    if (!result.ok) {
      return NextResponse.json({ error: result.code, message: confirmSiteErrorMessage(result.code) }, { status: 409 });
    }
    return NextResponse.json({ project: result.project }, { status: 200 });
  }

  if (toolName === "generate_site") {
    const args = action.arguments as Record<string, unknown>;
    const brief = args.brief as Record<string, unknown> | undefined;
    if (!brief) {
      return NextResponse.json({ error: "This action is missing its details." }, { status: 409 });
    }
    const result = await createSiteFromBrief(admin, actor, String(action.conversation_id), brief as SiteBrief);
    if (!result.ok) {
      return NextResponse.json({ error: result.code, message: result.message, upgrade_hint: result.upgrade_hint }, { status: 409 });
    }

    await admin.from("agent_pending_actions").update({ status: "executed", resolved_at: new Date().toISOString() }).eq("id", id);

    const assistantText = `Your draft website “${result.project.name}” is ready at ${`https://${result.project.subdomain}.get-on.tech`}. It is not published yet — you can open it from your dashboard to keep editing, or ask me to publish it.`;
    try {
      const { data: run } = await admin
        .from("agent_runs")
        .select("id")
        .eq("conversation_id", action.conversation_id)
        .eq("user_id", actor.userId)
        .eq("status", "running")
        .maybeSingle();
      if (run?.id) {
        await appendAgentMessage(admin, {
          conversationId: String(action.conversation_id),
          teamId: actor.teamId,
          userId: null,
          role: "assistant",
          content: assistantText,
          credits: result.credits,
        });
        await finishAgentRun(admin, String(run.id), { status: "succeeded" });
      }
    } catch {
      // Best effort to surface the result in the chat.
    }

    return NextResponse.json({ project: result.project, credits: result.credits, ai: result.ai }, { status: 200 });
  }

  return NextResponse.json({ error: "This action is not supported." }, { status: 409 });
}

function confirmSiteErrorMessage(code: string): string {
  switch (code) {
    case "AGENT_ACTION_NOT_FOUND":
      return "That website draft could not be found.";
    case "AGENT_ACTION_FORBIDDEN":
      return "You do not have permission to confirm this action.";
    case "AGENT_ACTION_RESOLVED":
      return "This action has already been resolved.";
    case "AGENT_ACTION_EXPIRED":
      return "This action has expired. Start over.";
    case "AGENT_ACTION_UNSUPPORTED":
      return "This action is not supported.";
    case "NAME_REQUIRED":
      return "Please give your website a name.";
    case "SUBDOMAIN_INVALID":
      return "Please enter a valid web address.";
    case "TEMPLATE_PLAN_REQUIRED":
      return "That template is not available on your plan.";
    case "LIMIT_WEBSITES_REACHED":
      return "You have reached your plan’s website limit.";
    case "WEBSITE_CREATE_RATE":
      return "You’re creating websites too quickly. Try again later.";
    case "SUBDOMAIN_TAKEN":
      return "That web address is already taken.";
    case "AGENT_CREATE_FAILED":
      return "We could not create the website draft.";
    default:
      return "We could not confirm the website draft.";
  }
}
