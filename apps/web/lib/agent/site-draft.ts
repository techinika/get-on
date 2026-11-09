import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAddress, validateAddress } from "@/lib/address";
import { templateAvailable, templateBySlug } from "@/lib/templates/catalog";
import { applyTemplateToProject } from "@/lib/templates/apply";
import type { AgentActor } from "./auth";
import {
  startAgentRun,
  finishAgentRun,
  appendAgentMessage,
  verifyAgentProject,
} from "./conversations";

const STARTER_SLUG = "starter";
const DRAFT_CREDITS = 0;
const PENDING_TTL_MS = 60 * 60 * 1000;

export type CreateSiteDraftInput = {
  name: string;
  address: string;
  templateSlug?: string | null;
};

export type CreateSiteDraftPreview = {
  name: string;
  address: string;
  primaryAddress: string;
  template: string | null;
  credits: number;
  warnings: string[];
};

function slugToPrimaryAddress(address: string): string {
  const rootDomain = (process.env.ROOT_DOMAIN as string | undefined) ?? "get-on.tech";
  return `https://${address}.${rootDomain}`;
}

export async function validateCreateSiteInput(
  actor: AgentActor,
  input: CreateSiteDraftInput,
): Promise<{ ok: true; address: string } | { ok: false; code: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, code: "NAME_REQUIRED" };
  if (name.length > 120) return { ok: false, code: "NAME_TOO_LONG" };

  const address = normalizeAddress(input.address);
  const validation = validateAddress(address);
  if (!validation.ok) return { ok: false, code: "SUBDOMAIN_INVALID" };

  const admin = createAdminClient();

  const templateSlug = input.templateSlug ?? STARTER_SLUG;
  if (templateSlug && !templateAvailable(actor.planId, templateSlug)) {
    return { ok: false, code: "TEMPLATE_PLAN_REQUIRED" };
  }

  const { data: quota } = await admin.rpc("team_quota_usage", {
    p_team: actor.teamId,
  });
  const maxWebsites =
    quota && typeof quota === "object" && "max_websites" in quota
      ? Number((quota as Record<string, unknown>).max_websites ?? 0)
      : null;
  const activeSites =
    quota && typeof quota === "object" && "active_sites" in quota
      ? Number((quota as Record<string, unknown>).active_sites ?? 0)
      : 0;
  if (maxWebsites !== null && activeSites >= (maxWebsites as number)) {
    return { ok: false, code: "LIMIT_WEBSITES_REACHED" };
  }

  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const hourAgo = new Date(Date.now() - 36e5).toISOString();
  const [{ count: teamDay }, { count: userHour }] = await Promise.all([
    admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("team_id", actor.teamId)
      .gte("created_at", dayAgo),
    admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("team_id", actor.teamId)
      .eq("created_by", actor.userId)
      .gte("created_at", hourAgo),
  ]);
  if ((teamDay ?? 0) >= 5 || (userHour ?? 0) >= 3) {
    return { ok: false, code: "WEBSITE_CREATE_RATE" };
  }

  const { data: available } = await admin.rpc("is_subdomain_available", {
    candidate: address,
  });
  if (available !== true) return { ok: false, code: "SUBDOMAIN_TAKEN" };

  return { ok: true, address };
}

export async function getCreateSiteDraftPreview(
  actor: AgentActor,
  input: CreateSiteDraftInput,
): Promise<{ ok: true; preview: CreateSiteDraftPreview } | { ok: false; code: string }> {
  const validated = await validateCreateSiteInput(actor, input);
  if (!validated.ok) return validated;

  const templateSlug = input.templateSlug ?? STARTER_SLUG;
  const template = templateBySlug(templateSlug);

  return {
    ok: true,
    preview: {
      name: input.name.trim(),
      address: validated.address,
      primaryAddress: slugToPrimaryAddress(validated.address),
      template: template ? template.name : null,
      credits: DRAFT_CREDITS,
      warnings: ["This creates a draft website. It is not published yet."],
    },
  };
}

export async function createSiteDraftPending(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  actor: AgentActor,
  input: CreateSiteDraftInput,
): Promise<{ ok: true; actionId: string; preview: CreateSiteDraftPreview } | { ok: false; code: string }> {
  const validated = await validateCreateSiteInput(actor, input);
  if (!validated.ok) return validated;

  const templateSlug = input.templateSlug ?? STARTER_SLUG;
  const template = templateBySlug(templateSlug);
  const preview: CreateSiteDraftPreview = {
    name: input.name.trim(),
    address: validated.address,
    primaryAddress: slugToPrimaryAddress(validated.address),
    template: template ? template.name : null,
    credits: DRAFT_CREDITS,
    warnings: ["This creates a draft website. It is not published yet."],
  };

  const expiresAt = new Date(Date.now() + PENDING_TTL_MS).toISOString();
  const { data, error } = await admin
    .from("agent_pending_actions")
    .insert({
      conversation_id: conversationId,
      team_id: actor.teamId,
      user_id: actor.userId,
      tool_name: "create_site",
      arguments: {
        name: input.name.trim(),
        address: validated.address,
        templateSlug,
      },
      preview,
      risk: "medium",
      estimated_credits: DRAFT_CREDITS,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[agent] could not create pending site action", error);
    return { ok: false, code: "AGENT_ACTION_FAILED" };
  }

  return { ok: true, actionId: String(data.id), preview };
}

export async function executeSiteDraft(
  admin: ReturnType<typeof createAdminClient>,
  actionId: string,
  actor: AgentActor,
): Promise<{
  ok: true;
  project: { id: string; name: string; subdomain: string; status: string };
} | { ok: false; code: string }> {
  const { data: action, error } = await admin
    .from("agent_pending_actions")
    .select(
      "id, conversation_id, tool_name, arguments, preview, status, expires_at, user_id, team_id",
    )
    .eq("id", actionId)
    .maybeSingle();
  if (error || !action) {
    return { ok: false, code: "AGENT_ACTION_NOT_FOUND" };
  }
  if (action.user_id !== actor.userId || action.team_id !== actor.teamId) {
    return { ok: false, code: "AGENT_ACTION_FORBIDDEN" };
  }
  if (action.status !== "pending") {
    return { ok: false, code: "AGENT_ACTION_RESOLVED" };
  }
  if (new Date(action.expires_at) < new Date()) {
    await admin
      .from("agent_pending_actions")
      .update({ status: "expired" })
      .eq("id", actionId);
    return { ok: false, code: "AGENT_ACTION_EXPIRED" };
  }
  if (action.tool_name !== "create_site") {
    return { ok: false, code: "AGENT_ACTION_UNSUPPORTED" };
  }

  const args = action.arguments as Record<string, unknown>;
  const name = String(args.name ?? "").trim();
  const address = normalizeAddress(String(args.address ?? ""));
  const templateSlug = (args.templateSlug ?? STARTER_SLUG) as string;

  const validated = await validateCreateSiteInput(actor, {
    name,
    address,
    templateSlug,
  });
  if (!validated.ok) return validated;

  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({
      team_id: actor.teamId,
      name,
      subdomain: address,
      status: "draft",
      created_by: actor.userId,
      created_via: "assistant",
      last_edited_by: actor.userId,
      last_edited_at: new Date().toISOString(),
      stats_site_key: crypto.randomUUID().replaceAll("-", "").slice(0, 16),
      settings: {
        businessType: "",
        about: "",
        startChoice: "blank",
        contact: { phone: "", email: "", address: "" },
        templateOrigin: {
          slug: templateSlug,
          name: templateBySlug(templateSlug)?.name ?? templateSlug,
          version: 1,
          appliedAt: new Date().toISOString(),
          mode: "full",
        },
      },
    })
    .select("id, name, subdomain, status")
    .single();
  if (projectError || !project) {
    if (projectError && (projectError as { code?: string }).code === "23505")
      return { ok: false, code: "SUBDOMAIN_TAKEN" };
    console.error("[agent] could not create draft website", projectError);
    return { ok: false, code: "AGENT_CREATE_FAILED" };
  }

  const applyResult = await applyTemplateToProject({
    supabase: admin,
    projectId: project.id,
    teamId: actor.teamId,
    slug: templateSlug,
    mode: "full",
    appliedBy: actor.userId,
  });
  if (!applyResult.ok) {
    console.error("[agent] could not apply starter template", applyResult.error);
  }

  const conversationId = String(action.conversation_id);
  await admin
    .from("agent_conversations")
    .update({ project_id: project.id })
    .eq("id", conversationId);

  await admin
    .from("agent_pending_actions")
    .update({ status: "executed", resolved_at: new Date().toISOString() })
    .eq("id", actionId);

  try {
    const run = await startAgentRun(admin, {
      conversationId,
      teamId: actor.teamId,
      userId: actor.userId,
    });
    if (run.ok) {
      const template = templateBySlug(templateSlug);
      const assistantText = `I’ve created your draft website “${name}” at ${slugToPrimaryAddress(
        address,
      )}. It uses the ${template?.name ?? "Starter"} template and is not published yet. Open it from your dashboard to keep editing.`;
      await appendAgentMessage(admin, {
        conversationId,
        teamId: actor.teamId,
        userId: null,
        role: "assistant",
        content: assistantText,
        credits: DRAFT_CREDITS,
      });
      await finishAgentRun(admin, run.id, { status: "succeeded" });
    }
  } catch (error) {
    console.error("[agent] could not post site-created reply", error);
  }

  return {
    ok: true,
    project: {
      id: project.id,
      name: project.name,
      subdomain: project.subdomain,
      status: project.status,
    },
  };
}

export async function cancelSiteDraft(
  admin: ReturnType<typeof createAdminClient>,
  actionId: string,
  actor: AgentActor,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const { data: action, error } = await admin
    .from("agent_pending_actions")
    .select("id, status, user_id, team_id")
    .eq("id", actionId)
    .maybeSingle();
  if (error || !action) return { ok: false, code: "AGENT_ACTION_NOT_FOUND" };
  if (action.user_id !== actor.userId || action.team_id !== actor.teamId) {
    return { ok: false, code: "AGENT_ACTION_FORBIDDEN" };
  }
  if (action.status !== "pending") return { ok: false, code: "AGENT_ACTION_RESOLVED" };
  await admin
    .from("agent_pending_actions")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", actionId);
  return { ok: true };
}

export { verifyAgentProject };
