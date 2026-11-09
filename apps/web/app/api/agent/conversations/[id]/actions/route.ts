import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseAssistant, getAgentActor } from "@/lib/agent/auth";
import { getAgentConversation } from "@/lib/agent/conversations";
import { createSiteDraftPending, getCreateSiteDraftPreview } from "@/lib/agent/site-draft";
import { getAssistantFeature } from "@/lib/agent/settings";

const bodySchema = z.object({
  tool: z.enum(["create_site"]),
  arguments: z.object({
    name: z.string().min(1).max(120),
    address: z.string().min(1).max(80),
    templateSlug: z.string().optional().nullable(),
  }),
});

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
  const conversation = await getAgentConversation(
    admin,
    id,
    actor.teamId,
    actor.userId,
  );
  if (!conversation) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That request is not valid." }, { status: 400 });
  }

  const preview = await getCreateSiteDraftPreview(actor, parsed.data.arguments);
  if (!preview.ok) {
    return NextResponse.json(
      { error: preview.code, message: createSiteErrorMessage(preview.code) },
      { status: 409 },
    );
  }

  const result = await createSiteDraftPending(
    admin,
    id,
    actor,
    parsed.data.arguments,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: createSiteErrorMessage(result.code) },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { actionId: result.actionId, preview: result.preview },
    { status: 201 },
  );
}

function createSiteErrorMessage(code: string): string {
  switch (code) {
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
    case "AGENT_ACTION_FAILED":
      return "We could not set up the website draft.";
    default:
      return "We could not create the website draft.";
  }
}
