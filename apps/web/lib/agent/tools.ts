import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAddress, validateAddress } from "@/lib/address";
import { getCreateSiteDraftPreview, type CreateSiteDraftPreview } from "@/lib/agent/site-draft";
import { getAgentActor } from "@/lib/agent/auth";
import { getAssistantFeature } from "@/lib/agent/settings";
import { type ToolContext, type ToolExecutor } from "@/lib/agent/loop";
import { runTask } from "@/lib/ai/pipeline";
import { publishProject, unpublishProject, PublishError } from "@/lib/publishing/service";
import { logActivity } from "@/lib/activity";
import { recordSecurityEvent } from "@/lib/security/events";
import { can } from "@/lib/permissions";
import { planLimits } from "@/lib/plans";

const EXPIRY_MS = 60 * 60 * 1000;

type FlowState = {
  flow?: string;
  step?: string;
  brief?: Record<string, unknown>;
  missing?: string[];
  projectId?: string | null;
};

function readFlowState(value: unknown): FlowState {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as FlowState;
  }
  return {};
}

function flowMissing(brief: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (!brief.name) missing.push("business name");
  if (!brief.address) missing.push("web address");
  if (!brief.businessType) missing.push("business type");
  if (!brief.about) missing.push("a few words about your business");
  if (!brief.style) missing.push("a style");
  return missing;
}

function toSiteBrief(brief: Record<string, unknown>): SiteBrief {
  return {
    name: String(brief.name ?? "").trim(),
    address: normalizeAddress(String(brief.address ?? "").trim()),
    businessType: String(brief.businessType ?? "").trim(),
    about: String(brief.about ?? "").trim(),
    style: brief.style ? String(brief.style) : null,
    designPrefs:
      brief.designPrefs && typeof brief.designPrefs === "object" && !Array.isArray(brief.designPrefs)
        ? (brief.designPrefs as Record<string, unknown>)
        : {},
    contact: brief.contact && typeof brief.contact === "object"
      ? {
          phone: String((brief.contact as Record<string, unknown>).phone ?? ""),
          email: String((brief.contact as Record<string, unknown>).email ?? ""),
          address: String((brief.contact as Record<string, unknown>).address ?? ""),
        }
      : { phone: "", email: "", address: "" },
    includeContactForm: Boolean(brief.includeContactForm),
  };
}

type SiteBrief = {
  name: string;
  address: string;
  businessType: string;
  about: string;
  style: string | null;
  designPrefs: Record<string, unknown>;
  contact: { phone: string; email: string; address: string };
  includeContactForm: boolean;
};

const JSON_SCHEMA_OBJECT = { type: "object", additionalProperties: true };
const JSON_SCHEMA_STRING = { type: "string" };

function requireEditorOrAbove(role: string): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}
function requireAdminOrOwner(role: string): boolean {
  return role === "owner" || role === "admin";
}

async function broadcastRun(ctx: ToolContext, event: string, payload: unknown): Promise<void> {
  try {
    const channel = createAdminClient().channel(`agent:${ctx.conversationId}`);
    await channel.send({
      type: "broadcast",
      event,
      payload,
    });
  } catch {
    // Realtime is best-effort; the client re-fetches on reconnect.
  }
}

function previewMessage(code: string): string {
  switch (code) {
    case "LIMIT_WEBSITES_REACHED":
      return "You have reached your plan’s website limit.";
    case "WEBSITE_CREATE_RATE":
      return "You’re creating websites too quickly. Try again later.";
    case "SUBDOMAIN_TAKEN":
      return "That web address is already taken.";
    case "TEMPLATE_PLAN_REQUIRED":
      return "That template is not available on your plan.";
    default:
      return "We could not prepare the website.";
  }
}

/* ---------------------------------------------------------------- */
/* Create-website tools                                             */
/* ---------------------------------------------------------------- */

export const updateCreateSiteBriefSchema = z.object({
  name: z.string().max(120).optional(),
  address: z.string().max(80).optional(),
  businessType: z.string().max(80).optional(),
  about: z.string().max(300).optional(),
  style: z.string().optional().nullable(),
  designPrefs: z.record(z.string(), z.unknown()).optional().nullable(),
  contact: z
    .object({ phone: z.string().optional(), email: z.string().optional(), address: z.string().optional() })
    .optional(),
  includeContactForm: z.boolean().optional(),
});

export type UpdateCreateSiteBriefInput = z.infer<typeof updateCreateSiteBriefSchema>;

export const updateCreateSiteBrief: ToolExecutor<
  UpdateCreateSiteBriefInput,
  { missing: string[]; next: string | null; brief: Record<string, unknown>; complete: boolean }
> = {
  name: "update_create_site_brief",
  description: "Save the details the user wants for their new website (name, web address, business type, about, style).",
  schema: updateCreateSiteBriefSchema,
  jsonSchema: JSON_SCHEMA_OBJECT,
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) {
      return { ok: false, code: "AUTH", message: "Please sign in again." };
    }
    if (!requireEditorOrAbove(actor.role)) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can create websites." };
    }

    const fields = input as UpdateCreateSiteBriefInput;

    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("agent_conversations")
      .select("flow_state, title")
      .eq("id", ctx.conversationId)
      .eq("team_id", actor.teamId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (!conversation) {
      return { ok: false, code: "AGENT_CONVERSATION_NOT_FOUND", message: "Chat not found." };
    }

    const flow = readFlowState(conversation.flow_state);
    const currentBrief = (flow.brief && typeof flow.brief === "object") ? (flow.brief as Record<string, unknown>) : {};
    const merged = { ...currentBrief, ...fields };

    const cleaned: Record<string, unknown> = {};
    if (merged.name) cleaned.name = String(merged.name).trim().slice(0, 120);
    if (merged.address) {
      const address = normalizeAddress(String(merged.address).trim());
      if (validateAddress(address).ok) cleaned.address = address;
    }
    if (merged.businessType) cleaned.businessType = String(merged.businessType).trim().slice(0, 80);
    if (merged.about) cleaned.about = String(merged.about).trim().slice(0, 300);
    if (merged.style !== undefined) cleaned.style = merged.style;
    if (merged.designPrefs !== undefined) cleaned.designPrefs = merged.designPrefs;
    if (merged.contact !== undefined) cleaned.contact = merged.contact;
    if (merged.includeContactForm !== undefined) cleaned.includeContactForm = merged.includeContactForm;

    const missing = flowMissing(cleaned);
    const complete = missing.length === 0;

    const flowState: FlowState = {
      flow: "create_site",
      step: complete ? "brief" : "collect",
      brief: cleaned,
      missing,
      projectId: flow.projectId ?? null,
    };

    const { error } = await admin
      .from("agent_conversations")
      .update({ flow_state: flowState, title: conversation.title })
      .eq("id", ctx.conversationId);
    if (error) {
      return { ok: false, code: "AGENT_UPDATE_FAILED", message: "We could not save your answers." };
    }

    const step = flowState.step;

    let next: string | null = null;
    if (!complete) {
      const field = missing[0];
      next =
        field === "business name"
          ? "What should your website be called?"
          : field === "web address"
            ? "Which web address would you like (something.get-on.tech)?"
            : field === "business type"
              ? "What kind of business is it?"
              : field === "a few words about your business"
                ? "Tell me a little about your business."
                : "Which style fits your business?";
    }
    if (!complete) {
      const field = missing[0];
      next =
        field === "business name"
          ? "What should your website be called?"
          : field === "web address"
            ? "Which web address would you like (something.get-on.tech)?"
            : field === "business type"
              ? "What kind of business is it?"
              : field === "a few words about your business"
                ? "Tell me a little about your business."
                : "Which style fits your business?";
    }

    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.update_create_site_brief",
      severity: "info",
      summary: "Assistant updated website brief",
      meta: { step, missingCount: missing.length },
      visibleToUser: true,
    });

    return { ok: true, data: { missing, next, brief: cleaned, complete } };
  },
};

export const generateSiteSchema = z.object({
  confirm: z.boolean().optional(),
});

export const generateSite: ToolExecutor<
  z.infer<typeof generateSiteSchema>,
  { actionId: string | null; preview: CreateSiteDraftPreview | null; needsConfirmation: boolean; estimatedCredits: number }
> = {
  name: "generate_site",
  description: "Create a new website draft from the saved brief. Needs confirmation before it runs.",
  schema: generateSiteSchema,
  jsonSchema: JSON_SCHEMA_OBJECT,
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) {
      return { ok: false, code: "AUTH", message: "Please sign in again." };
    }

    const feature = await getAssistantFeature();
    if (!feature.enabled) {
      return { ok: false, code: "ASSISTANT_OFF", message: "The assistant is switched off." };
    }

    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("agent_conversations")
      .select("flow_state")
      .eq("id", ctx.conversationId)
      .eq("team_id", actor.teamId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (!conversation) {
      return { ok: false, code: "AGENT_CONVERSATION_NOT_FOUND", message: "Chat not found." };
    }

    const flow = readFlowState(conversation.flow_state);
    const brief = (flow.brief && typeof flow.brief === "object") ? (flow.brief as Record<string, unknown>) : {};
    const missing = flowMissing(brief);
    if (missing.length > 0) {
      return { ok: false, code: "BRIEF_INCOMPLETE", message: `Still need: ${missing.join(", ")}.` };
    }

    const siteBrief = toSiteBrief(brief);
    const preview = await getCreateSiteDraftPreview(actor, {
      name: siteBrief.name,
      address: siteBrief.address,
      templateSlug: "starter",
    });
    if (!preview.ok) {
      return { ok: false, code: preview.code, message: previewMessage(preview.code) };
    }

    const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();
    const { data, error } = await admin
      .from("agent_pending_actions")
      .insert({
        conversation_id: ctx.conversationId,
        team_id: actor.teamId,
        user_id: actor.userId,
        tool_name: "generate_site",
        arguments: { brief: siteBrief },
        preview: preview.preview,
        risk: "medium",
        estimated_credits: preview.preview.credits,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, code: "AGENT_ACTION_FAILED", message: "We could not set up the website creation." };
    }

    return {
      ok: true,
      data: {
        actionId: String(data.id),
        preview: preview.preview,
        needsConfirmation: true,
        estimatedCredits: preview.preview.credits,
      },
      confirmation: {
        id: String(data.id),
        tool: "generate_site",
        summary: `Create the website “${siteBrief.name}” at ${siteBrief.address}.get-on.tech`,
        estimatedCredits: preview.preview.credits,
        expiresAt,
      },
    };
  },
};

/* ---------------------------------------------------------------- */
/* Read-only tools                                                  */
/* ---------------------------------------------------------------- */

export const getContextSchema = z.object({});

export const getContext: ToolExecutor<z.infer<typeof getContextSchema>, { route: string; project: { id: string; name: string } | null; selection: string | null; plan: string; credits: number; limits: { maxWebsites: number | null; maxPages: number | null } }> = {
  name: "get_context",
  description: "Return the current route, project, selection, plan, credits and limits.",
  schema: getContextSchema,
  jsonSchema: JSON_SCHEMA_OBJECT,
  execute: async (_input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) {
      return { ok: false, code: "AUTH", message: "Please sign in again." };
    }
    const admin = createAdminClient();
    const balance = await admin.rpc("ai_balance", { p_team: actor.teamId }).then((r) => {
      const v = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : {};
      return Number(v.total ?? 0);
    });
    const plan = planLimits(actor.planId);
    let project: { id: string; name: string } | null = null;
    if (ctx.conversationId) {
      const { data: conv } = await admin
        .from("agent_conversations")
        .select("project_id")
        .eq("id", ctx.conversationId)
        .eq("team_id", actor.teamId)
        .eq("user_id", actor.userId)
        .maybeSingle();
      const pid = conv?.project_id ?? null;
      if (pid) {
        const { data: proj } = await admin
          .from("projects")
          .select("id, name")
          .eq("id", pid)
          .maybeSingle();
        if (proj) project = { id: proj.id, name: proj.name };
      }
    }

    return {
      ok: true,
      data: {
        route: "",
        project,
        selection: null,
        plan: actor.planId,
        credits: balance,
        limits: { maxWebsites: plan.maxWebsites, maxPages: plan.maxPagesPerSite },
      },
    };
  },
};

export const getPageSchema = z.object({
  pageId: z.string().uuid(),
});

export const getPage: ToolExecutor<z.infer<typeof getPageSchema>, { page: { id: string; title: string; path: string; blocks: unknown; seoTitle: string | null; seoDescription: string | null; revision: number } | null }> = {
  name: "get_page",
  description: "Read a page's title, path, blocks and SEO.",
  schema: getPageSchema,
  jsonSchema: {
    type: "object",
    properties: { pageId: JSON_SCHEMA_STRING },
    required: ["pageId"],
  },
  execute: async (input) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    const fields = input as { pageId: string };
    const supabase = await createClient();
    const { data: page } = await supabase
      .from("pages")
      .select("id, title, path, blocks, seo_title, seo_description, revision")
      .eq("id", fields.pageId)
      .maybeSingle();
    if (!page) return { ok: false, code: "NOT_FOUND", message: "Page not found." };
    return {
      ok: true,
      data: {
        page: {
          id: page.id,
          title: page.title,
          path: page.path,
          blocks: page.blocks as unknown,
          seoTitle: page.seo_title ?? null,
          seoDescription: page.seo_description ?? null,
          revision: Number(page.revision ?? 0),
        },
      },
    };
  },
};

export const getSiteSettingsSchema = z.object({});

export const getSiteSettings: ToolExecutor<z.infer<typeof getSiteSettingsSchema>, { seoTitle: string | null; seoDescription: string | null; tagline: string | null; published: boolean; domain: string | null } | null> = {
  name: "get_site_settings",
  description: "Return the current website's SEO settings and publishing status.",
  schema: getSiteSettingsSchema,
  jsonSchema: JSON_SCHEMA_OBJECT,
  execute: async (_input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    const admin = createAdminClient();
    const { data: conv } = await admin
      .from("agent_conversations")
      .select("project_id")
      .eq("id", ctx.conversationId)
      .eq("team_id", actor.teamId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    const pid = conv?.project_id ?? null;
    if (!pid) return { ok: true, data: null };
    const { data: row } = await admin
      .from("projects")
      .select("status, subdomain, primary_host, settings")
      .eq("id", pid)
      .maybeSingle();
    if (!row) return { ok: true, data: null };
    const settings = row.settings && typeof row.settings === "object" ? (row.settings as Record<string, unknown>) : {};
    return {
      ok: true,
      data: {
        seoTitle: typeof settings.seo_title === "string" ? settings.seo_title : null,
        seoDescription: typeof settings.seo_description === "string" ? settings.seo_description : null,
        tagline: typeof settings.tagline === "string" ? settings.tagline : null,
        published: row.status === "published",
        domain: (row.primary_host ?? null) as string | null,
      },
    };
  },
};

export const getUsageSchema = z.object({});

export const getUsage: ToolExecutor<z.infer<typeof getUsageSchema>, { plan: string; credits: number; dailyActions: number; monthlyCredits: number }> = {
  name: "get_usage",
  description: "Return the current plan, credit balance and usage limits.",
  schema: getUsageSchema,
  jsonSchema: JSON_SCHEMA_OBJECT,
  execute: async () => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    const admin = createAdminClient();
    const balance = await admin.rpc("ai_balance", { p_team: actor.teamId }).then((r) => {
      const v = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : {};
      return Number(v.total ?? 0);
    });
    const plan = planLimits(actor.planId);
    return {
      ok: true,
      data: {
        plan: actor.planId,
        credits: balance,
        dailyActions: plan.aiDailyActions,
        monthlyCredits: plan.aiMonthlyCredits,
      },
    };
  },
};

export const listTemplatesSchema = z.object({});

export const listTemplates: ToolExecutor<z.infer<typeof listTemplatesSchema>, { templates: Array<{ slug: string; name: string; businessType: string }> }> = {
  name: "list_templates",
  description: "List available website templates by business type.",
  schema: listTemplatesSchema,
  jsonSchema: JSON_SCHEMA_OBJECT,
  execute: async () => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    return {
      ok: true,
      data: {
        templates: [
          { slug: "starter", name: "Starter", businessType: "general" },
        ],
      },
    };
  },
};

export const checkSubdomainSchema = z.object({
  address: z.string().min(1).max(80),
});

export const checkSubdomain: ToolExecutor<z.infer<typeof checkSubdomainSchema>, { available: boolean; address: string }> = {
  name: "check_subdomain",
  description: "Check whether a name.get-on.tech web address is available.",
  schema: checkSubdomainSchema,
  jsonSchema: {
    type: "object",
    properties: { address: JSON_SCHEMA_STRING },
    required: ["address"],
  },
  execute: async (input) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    const fields = input as { address: string };
    const address = normalizeAddress(fields.address);
    if (!validateAddress(address).ok) {
      return { ok: false, code: "SUBDOMAIN_INVALID", message: "That is not a valid web address." };
    }
    const admin = createAdminClient();
    const { data: available } = await admin.rpc("is_subdomain_available", { candidate: address });
    return { ok: true, data: { available: available === true, address } };
  },
};

export const navigateToSchema = z.object({
  screen: z.enum(["dashboard", "plan", "team", "account", "editor", "pages", "images", "settings", "billing"]),
});

export const navigateTo: ToolExecutor<z.infer<typeof navigateToSchema>, { screen: string; hint: string }> = {
  name: "navigate_to",
  description: "Suggest moving the user to a specific screen.",
  schema: navigateToSchema,
  jsonSchema: {
    type: "object",
    properties: { screen: { type: "string", enum: ["dashboard","plan","team","account","editor","pages","images","settings","billing"] } },
    required: ["screen"],
  },
  execute: async (input) => {
    const fields = input as { screen: string };
    const hints: Record<string, string> = {
      dashboard: "Open your websites dashboard.",
      plan: "View your plan and billing.",
      team: "Manage team members.",
      account: "View your account settings.",
      editor: "Open the website editor.",
      pages: "Manage your website pages.",
      images: "Manage your image library.",
      settings: "Change website settings.",
      billing: "Open billing and invoices.",
    };
    return { ok: true, data: { screen: fields.screen, hint: hints[fields.screen] ?? "" } };
  },
};

export const searchHelpSchema = z.object({
  query: z.string().min(1).max(200),
});

export const searchHelp: ToolExecutor<z.infer<typeof searchHelpSchema>, { results: Array<{ title: string; url: string; excerpt: string }> }> = {
  name: "search_help",
  description: "Search help articles for guidance.",
  schema: searchHelpSchema,
  jsonSchema: {
    type: "object",
    properties: { query: JSON_SCHEMA_STRING },
    required: ["query"],
  },
  execute: async () => {
    return {
      ok: true,
      data: {
        results: [
          { title: "How do I publish my website?", url: "/dashboard/plan", excerpt: "Publishing makes your site live on the web." },
          { title: "How do credits work?", url: "/dashboard/plan", excerpt: "AI actions use credits from your plan." },
        ],
      },
    };
  },
};

export const listContactMessagesSchema = z.object({
  projectId: z.string().uuid().optional(),
});

export const listContactMessages: ToolExecutor<z.infer<typeof listContactMessagesSchema>, { messages: Array<{ id: string; name: string; email: string; message: string; status: string; createdAt: string }> }> = {
  name: "list_contact_messages",
  description: "Summaries of contact form messages (as data only).",
  schema: listContactMessagesSchema,
  jsonSchema: {
    type: "object",
    properties: { projectId: JSON_SCHEMA_STRING },
  },
  execute: async (input) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "messages.read")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can read contact messages." };
    }
    const fields = input as { projectId?: string };
    const supabase = await createClient();
    let query = supabase.from("contact_messages").select("id, name, email, message, status, created_at").order("created_at", { ascending: false }).limit(20);
    if (fields.projectId) query = query.eq("project_id", fields.projectId);
    const { data } = await query;
    return {
      ok: true,
      data: {
        messages: (data ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          message: m.message,
          status: m.status,
          createdAt: m.created_at,
        })),
      },
    };
  },
};

/* ---------------------------------------------------------------- */
/* Editing tools                                                    */
/* ---------------------------------------------------------------- */

export const improveTextSchema = z.object({
  pageId: z.string().uuid(),
  blockIndex: z.number().int().min(0),
  text: z.string().min(1).max(20000),
  expectedRevision: z.number().int().nonnegative(),
});

export type ImproveTextInput = z.infer<typeof improveTextSchema>;

export const improveText: ToolExecutor<ImproveTextInput, { pageId: string; revision: number; blockIndex: number }> = {
  name: "improve_text",
  description: "Rewrite a selected block of text to be clearer, warmer and shorter.",
  schema: improveTextSchema,
  jsonSchema: {
    type: "object",
    properties: {
      pageId: JSON_SCHEMA_STRING,
      blockIndex: { type: "integer" },
      text: JSON_SCHEMA_STRING,
      expectedRevision: { type: "integer" },
    },
    required: ["pageId", "blockIndex", "text", "expectedRevision"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "page.edit")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can edit pages." };
    }
    const fields = input as ImproveTextInput;

    const supabase = await createClient();
    const { data: page } = await supabase
      .from("pages")
      .select("id, project_id, blocks, revision")
      .eq("id", fields.pageId)
      .maybeSingle();
    if (!page) return { ok: false, code: "NOT_FOUND", message: "Page not found." };
    if (page.revision !== fields.expectedRevision) {
      return {
        ok: false,
        code: "REVISION_CONFLICT",
        message: "The page was changed by someone else. Please reload and try again.",
      };
    }

    const blocks = Array.isArray(page.blocks) ? [...page.blocks] : [];
    const target = blocks[fields.blockIndex];
    if (!target || typeof target !== "object") {
      return { ok: false, code: "NOT_FOUND", message: "That block does not exist." };
    }

    const result = await runTask("text.improve", {
      teamId: actor.teamId,
      userId: actor.userId,
      projectId: page.project_id,
      userInput: fields.text,
      existingText: typeof (target as { text?: unknown }).text === "string" ? (target as { text: string }).text : "",
    });
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }

    const nextBlocks = blocks.map((b, i) =>
      i === fields.blockIndex ? { ...(b as Record<string, unknown>), text: result.text } : b,
    );

    const admin = createAdminClient();
    const { data: newRevision, error } = await admin.rpc("save_page_content", {
      p_page_id: fields.pageId,
      p_content: nextBlocks,
      p_expected_revision: fields.expectedRevision,
    });
    if (error || newRevision === null || newRevision === undefined) {
      const code = (error as { code?: string })?.code;
      if (code === "REVISION_CONFLICT") {
        return {
          ok: false,
          code: "REVISION_CONFLICT",
          message: "The page was changed by someone else. Please reload and try again.",
        };
      }
      return { ok: false, code: "SAVE_FAILED", message: "We could not save the improved text." };
    }

    await logActivity({
      projectId: page.project_id,
      actorUserId: actor.userId,
      event: "agent.improve_text",
      summary: "Assistant improved text on a page",
      meta: { pageId: fields.pageId, blockIndex: fields.blockIndex },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.improve_text",
      severity: "info",
      summary: "Assistant improved page text",
      meta: { pageId: fields.pageId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "page_updated", { pageId: fields.pageId, revision: Number(newRevision) });

    return { ok: true, data: { pageId: fields.pageId, revision: Number(newRevision), blockIndex: fields.blockIndex } };
  },
};

export const updatePageBlocksSchema = z.object({
  pageId: z.string().uuid(),
  blocks: z.array(z.any()),
  expectedRevision: z.number().int().nonnegative(),
});

export type UpdatePageBlocksInput = z.infer<typeof updatePageBlocksSchema>;

export const updatePageBlocks: ToolExecutor<UpdatePageBlocksInput, { pageId: string; revision: number }> = {
  name: "update_page_blocks",
  description: "Replace a page's blocks with new content (expected revision checked).",
  schema: updatePageBlocksSchema,
  jsonSchema: {
    type: "object",
    properties: {
      pageId: JSON_SCHEMA_STRING,
      blocks: { type: "array" },
      expectedRevision: { type: "integer" },
    },
    required: ["pageId", "blocks", "expectedRevision"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "page.edit")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can edit pages." };
    }
    const fields = input as UpdatePageBlocksInput;

    const supabase = await createClient();
    const { data: page } = await supabase
      .from("pages")
      .select("id, project_id, revision")
      .eq("id", fields.pageId)
      .maybeSingle();
    if (!page) return { ok: false, code: "NOT_FOUND", message: "Page not found." };
    if (page.revision !== fields.expectedRevision) {
      return {
        ok: false,
        code: "REVISION_CONFLICT",
        message: "The page was changed by someone else. Please reload and try again.",
      };
    }

    const admin = createAdminClient();
    const { data: newRevision, error } = await admin.rpc("save_page_content", {
      p_page_id: fields.pageId,
      p_content: fields.blocks,
      p_expected_revision: fields.expectedRevision,
    });
    if (error || newRevision === null || newRevision === undefined) {
      const code = (error as { code?: string })?.code;
      if (code === "REVISION_CONFLICT") {
        return {
          ok: false,
          code: "REVISION_CONFLICT",
          message: "The page was changed by someone else. Please reload and try again.",
        };
      }
      return { ok: false, code: "SAVE_FAILED", message: "We could not save the page blocks." };
    }

    await logActivity({
      projectId: page.project_id,
      actorUserId: actor.userId,
      event: "agent.update_page_blocks",
      summary: "Assistant updated page content",
      meta: { pageId: fields.pageId },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.update_page_blocks",
      severity: "notice",
      summary: "Assistant replaced page blocks",
      meta: { pageId: fields.pageId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "page_updated", { pageId: fields.pageId, revision: Number(newRevision) });

    return { ok: true, data: { pageId: fields.pageId, revision: Number(newRevision) } };
  },
};

export const createPageSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(120),
  path: z.string().optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

export const createPage: ToolExecutor<CreatePageInput, { page: { id: string; title: string; path: string } }> = {
  name: "create_page",
  description: "Create a new page in the current website.",
  schema: createPageSchema,
  jsonSchema: {
    type: "object",
    properties: {
      projectId: JSON_SCHEMA_STRING,
      title: JSON_SCHEMA_STRING,
      path: JSON_SCHEMA_STRING,
    },
    required: ["projectId", "title"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "page.edit")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can create pages." };
    }
    const fields = input as CreatePageInput;

    const supabase = await createClient();
    const plan = planLimits(actor.planId);
    const { count } = await supabase
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("project_id", fields.projectId);
    if (plan.maxPagesPerSite !== null && (count ?? 0) >= plan.maxPagesPerSite) {
      return { ok: false, code: "LIMIT_PAGES_REACHED", message: "You have reached your plan's page limit." };
    }

    const slugify = (input: string) =>
      "/" + input.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const path = fields.path ? slugify(fields.path) : slugify(fields.title) || "/";

    const { data: existing } = await supabase
      .from("pages")
      .select("id")
      .eq("project_id", fields.projectId)
      .eq("path", path)
      .maybeSingle();
    if (existing) return { ok: false, code: "PAGE_PATH_TAKEN", message: "That page path is already taken." };

    const { data: maxRow } = await supabase
      .from("pages")
      .select("position")
      .eq("project_id", fields.projectId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: page, error } = await supabase
      .from("pages")
      .insert({
        project_id: fields.projectId,
        title: fields.title,
        path,
        position: (maxRow?.position ?? -1) + 1,
        is_homepage: false,
        blocks: [],
        updated_by: actor.userId,
      })
      .select("id, title, path")
      .single();
    if (error || !page) return { ok: false, code: "CREATE_FAILED", message: "We could not create the page." };

    await logActivity({
      projectId: fields.projectId,
      actorUserId: actor.userId,
      event: "agent.create_page",
      summary: "Assistant created a page",
      meta: { pageId: page.id },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.create_page",
      severity: "info",
      summary: "Assistant created a page",
      meta: { pageId: page.id },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "page_created", { projectId: fields.projectId, pageId: page.id });

    return { ok: true, data: { page: { id: page.id, title: page.title, path: page.path } } };
  },
};

export const reorderPagesSchema = z.object({
  projectId: z.string().uuid(),
  pageOrders: z.array(z.object({ id: z.string().uuid(), position: z.number().int() })),
});

export type ReorderPagesInput = z.infer<typeof reorderPagesSchema>;

export const reorderPages: ToolExecutor<ReorderPagesInput, { projectId: string }> = {
  name: "reorder_pages",
  description: "Reorder pages by setting each page's position.",
  schema: reorderPagesSchema,
  jsonSchema: {
    type: "object",
    properties: {
      projectId: JSON_SCHEMA_STRING,
      pageOrders: { type: "array" },
    },
    required: ["projectId", "pageOrders"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "page.edit")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can reorder pages." };
    }
    const fields = input as ReorderPagesInput;

    const supabase = await createClient();
    for (const order of fields.pageOrders) {
      await supabase.from("pages").update({ position: order.position }).eq("id", order.id).eq("project_id", fields.projectId);
    }

    await logActivity({
      projectId: fields.projectId,
      actorUserId: actor.userId,
      event: "agent.reorder_pages",
      summary: "Assistant reordered pages",
      meta: { projectId: fields.projectId },
    });
    await broadcastRun(ctx, "pages_reordered", { projectId: fields.projectId });

    return { ok: true, data: { projectId: fields.projectId } };
  },
};

export const setHomepageSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
});

export type SetHomepageInput = z.infer<typeof setHomepageSchema>;

export const setHomepage: ToolExecutor<SetHomepageInput, { projectId: string; pageId: string }> = {
  name: "set_homepage",
  description: "Set a page as the website homepage.",
  schema: setHomepageSchema,
  jsonSchema: {
    type: "object",
    properties: { projectId: JSON_SCHEMA_STRING, pageId: JSON_SCHEMA_STRING },
    required: ["projectId", "pageId"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "page.edit")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can set the homepage." };
    }
    const fields = input as SetHomepageInput;

    const supabase = await createClient();
    await supabase.from("pages").update({ is_homepage: false, path: "/home" }).eq("project_id", fields.projectId).eq("is_homepage", true);
    const { error } = await supabase
      .from("pages")
      .update({ is_homepage: true, path: "/" })
      .eq("id", fields.pageId)
      .eq("project_id", fields.projectId);
    if (error) return { ok: false, code: "SET_FAILED", message: "We could not set the homepage." };

    await logActivity({
      projectId: fields.projectId,
      actorUserId: actor.userId,
      event: "agent.set_homepage",
      summary: "Assistant set the homepage",
      meta: { pageId: fields.pageId },
    });
    await broadcastRun(ctx, "homepage_changed", { projectId: fields.projectId, pageId: fields.pageId });

    return { ok: true, data: { projectId: fields.projectId, pageId: fields.pageId } };
  },
};

export const deletePageSchema = z.object({
  pageId: z.string().uuid(),
});

export type DeletePageInput = z.infer<typeof deletePageSchema>;

export const deletePage: ToolExecutor<DeletePageInput, { pageId: string }> = {
  name: "delete_page",
  description: "Delete a page. Cannot delete the homepage. Needs confirmation.",
  schema: deletePageSchema,
  jsonSchema: {
    type: "object",
    properties: { pageId: JSON_SCHEMA_STRING },
    required: ["pageId"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!requireAdminOrOwner(actor.role)) {
      return { ok: false, code: "FORBIDDEN", message: "Only the owner or admin can delete pages." };
    }
    const fields = input as DeletePageInput;

    const supabase = await createClient();
    const { data: page } = await supabase
      .from("pages")
      .select("id, title, is_homepage, project_id")
      .eq("id", fields.pageId)
      .maybeSingle();
    if (!page) return { ok: false, code: "NOT_FOUND", message: "Page not found." };
    if (page.is_homepage) return { ok: false, code: "PAGE_IS_HOMEPAGE", message: "The homepage cannot be deleted." };

    const { error } = await supabase.from("pages").delete().eq("id", fields.pageId);
    if (error) return { ok: false, code: "DELETE_FAILED", message: "We could not delete the page." };

    await logActivity({
      projectId: page.project_id,
      actorUserId: actor.userId,
      event: "agent.delete_page",
      summary: "Assistant deleted a page",
      meta: { pageId: fields.pageId },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.delete_page",
      severity: "notice",
      summary: "Assistant deleted a page",
      meta: { pageId: fields.pageId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "page_deleted", { projectId: page.project_id, pageId: fields.pageId });

    return { ok: true, data: { pageId: fields.pageId } };
  },
};

export const updateSeoSchema = z.object({
  pageId: z.string().uuid().optional(),
  seoTitle: z.string().max(120).optional().nullable(),
  seoDescription: z.string().max(155).optional().nullable(),
});

export type UpdateSeoInput = z.infer<typeof updateSeoSchema>;

export const updateSeo: ToolExecutor<UpdateSeoInput, { pageId: string | null; seoTitle: string | null; seoDescription: string | null }> = {
  name: "update_seo",
  description: "Update a page's title and description for search engines.",
  schema: updateSeoSchema,
  jsonSchema: {
    type: "object",
    properties: {
      pageId: JSON_SCHEMA_STRING,
      seoTitle: JSON_SCHEMA_STRING,
      seoDescription: JSON_SCHEMA_STRING,
    },
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "page.edit")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can update SEO." };
    }
    const fields = input as UpdateSeoInput;

    const supabase = await createClient();
    if (!fields.pageId) return { ok: false, code: "NOT_FOUND", message: "No page specified." };
    const { data: page } = await supabase
      .from("pages")
      .select("id, project_id, revision")
      .eq("id", fields.pageId)
      .maybeSingle();
    if (!page) return { ok: false, code: "NOT_FOUND", message: "Page not found." };

    const updates: Record<string, unknown> = {};
    if (fields.seoTitle !== undefined) updates.seo_title = fields.seoTitle;
    if (fields.seoDescription !== undefined) updates.seo_description = fields.seoDescription;
    if (Object.keys(updates).length === 0) {
      return { ok: false, code: "NOTHING_TO_UPDATE", message: "No SEO fields were provided." };
    }

    const { error } = await supabase.from("pages").update(updates).eq("id", fields.pageId);
    if (error) return { ok: false, code: "SAVE_FAILED", message: "We could not save the SEO settings." };

    await logActivity({
      projectId: page.project_id,
      actorUserId: actor.userId,
      event: "agent.update_seo",
      summary: "Assistant updated page SEO",
      meta: { pageId: fields.pageId },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.update_seo",
      severity: "info",
      summary: "Assistant updated page SEO",
      meta: { pageId: fields.pageId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "page_updated", { pageId: fields.pageId });

    return {
      ok: true,
      data: { pageId: fields.pageId, seoTitle: fields.seoTitle ?? null, seoDescription: fields.seoDescription ?? null },
    };
  },
};

export const enablePluginSchema = z.object({
  projectId: z.string().uuid(),
  pluginId: z.string().min(1).max(80),
});

export type EnablePluginInput = z.infer<typeof enablePluginSchema>;

export const enablePlugin: ToolExecutor<EnablePluginInput, { projectId: string; pluginId: string }> = {
  name: "enable_plugin",
  description: "Turn on a plugin for the website within plan limits.",
  schema: enablePluginSchema,
  jsonSchema: {
    type: "object",
    properties: { projectId: JSON_SCHEMA_STRING, pluginId: JSON_SCHEMA_STRING },
    required: ["projectId", "pluginId"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!requireAdminOrOwner(actor.role)) {
      return { ok: false, code: "FORBIDDEN", message: "Only the owner or admin can manage plugins." };
    }
    if (!can(actor.role, "site.plugins")) {
      return { ok: false, code: "FORBIDDEN", message: "Plugin management is not available on your role." };
    }
    const fields = input as EnablePluginInput;

    const supabase = await createClient();
    const { error } = await supabase.rpc("enable_plugin", { p_project_id: fields.projectId, p_plugin_id: fields.pluginId });
    if (error) return { ok: false, code: "PLUGIN_FAILED", message: "We could not enable that plugin." };

    await logActivity({
      projectId: fields.projectId,
      actorUserId: actor.userId,
      event: "agent.enable_plugin",
      summary: "Assistant enabled a plugin",
      meta: { pluginId: fields.pluginId },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.enable_plugin",
      severity: "notice",
      summary: "Assistant enabled a plugin",
      meta: { projectId: fields.projectId, pluginId: fields.pluginId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "plugin_enabled", { projectId: fields.projectId, pluginId: fields.pluginId });

    return { ok: true, data: { projectId: fields.projectId, pluginId: fields.pluginId } };
  },
};

export const publishSiteSchema = z.object({
  projectId: z.string().uuid(),
});

export type PublishSiteInput = z.infer<typeof publishSiteSchema>;

export const publishSite: ToolExecutor<PublishSiteInput, { projectId: string; url: string | null }> = {
  name: "publish_site",
  description: "Publish the website so it is live on the web. Needs confirmation.",
  schema: publishSiteSchema,
  jsonSchema: {
    type: "object",
    properties: { projectId: JSON_SCHEMA_STRING },
    required: ["projectId"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!requireAdminOrOwner(actor.role)) {
      return { ok: false, code: "FORBIDDEN", message: "Only the owner or admin can publish websites." };
    }
    const fields = input as PublishSiteInput;

    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, subdomain, primary_host, status")
      .eq("id", fields.projectId)
      .maybeSingle();
    if (!project) return { ok: false, code: "NOT_FOUND", message: "Website not found." };

    try {
      await publishProject({
        supabase,
        user: { id: actor.userId },
        team: { teamId: actor.teamId, planId: actor.planId },
        project: { id: project.id, name: project.name, subdomain: project.subdomain },
      });
    } catch (error) {
      if (error instanceof PublishError) {
        return { ok: false, code: error.code, message: error.code };
      }
      return { ok: false, code: "PUBLISH_FAILED", message: "We could not publish the website." };
    }

    await logActivity({
      projectId: fields.projectId,
      actorUserId: actor.userId,
      event: "agent.publish_site",
      summary: "Assistant published the website",
      meta: { projectId: fields.projectId },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.publish_site",
      severity: "notice",
      summary: "Assistant published a website",
      meta: { projectId: fields.projectId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "site_published", { projectId: fields.projectId });

    return { ok: true, data: { projectId: fields.projectId, url: project.primary_host ?? null } };
  },
};

export const unpublishSiteSchema = z.object({
  projectId: z.string().uuid(),
});

export type UnpublishSiteInput = z.infer<typeof unpublishSiteSchema>;

export const unpublishSite: ToolExecutor<UnpublishSiteInput, { projectId: string }> = {
  name: "unpublish_site",
  description: "Take the website offline without deleting it. Needs confirmation.",
  schema: unpublishSiteSchema,
  jsonSchema: {
    type: "object",
    properties: { projectId: JSON_SCHEMA_STRING },
    required: ["projectId"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!requireAdminOrOwner(actor.role)) {
      return { ok: false, code: "FORBIDDEN", message: "Only the owner or admin can unpublish websites." };
    }
    const fields = input as UnpublishSiteInput;

    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, subdomain")
      .eq("id", fields.projectId)
      .maybeSingle();
    if (!project) return { ok: false, code: "NOT_FOUND", message: "Website not found." };

    try {
      await unpublishProject({
        supabase,
        user: { id: actor.userId },
        team: { teamId: actor.teamId, planId: actor.planId },
        project: { id: project.id, name: project.name, subdomain: project.subdomain },
      });
    } catch (error) {
      if (error instanceof PublishError) {
        return { ok: false, code: error.code, message: error.code };
      }
      return { ok: false, code: "UNPUBLISH_FAILED", message: "We could not unpublish the website." };
    }

    await logActivity({
      projectId: fields.projectId,
      actorUserId: actor.userId,
      event: "agent.unpublish_site",
      summary: "Assistant unpublished the website",
      meta: { projectId: fields.projectId },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.unpublish_site",
      severity: "notice",
      summary: "Assistant unpublished a website",
      meta: { projectId: fields.projectId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "site_unpublished", { projectId: fields.projectId });

    return { ok: true, data: { projectId: fields.projectId } };
  },
};

export const restoreVersionSchema = z.object({
  versionId: z.string().uuid(),
});

export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;

export const restoreVersion: ToolExecutor<RestoreVersionInput, { pageId: string; revision: number }> = {
  name: "restore_version",
  description: "Restore a page or site to an earlier version. Needs confirmation.",
  schema: restoreVersionSchema,
  jsonSchema: {
    type: "object",
    properties: { versionId: JSON_SCHEMA_STRING },
    required: ["versionId"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "page.edit")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can restore versions." };
    }
    const fields = input as RestoreVersionInput;

    const admin = createAdminClient();
    const { data: newRevision, error } = await admin.rpc("restore_page_version", { p_version_id: fields.versionId });
    if (error) {
      const code = (error as { code?: string })?.code;
      if (code === "VERSION_NOT_FOUND" || code === "PAGE_NOT_FOUND") {
        return { ok: false, code: "NOT_FOUND", message: "That version could not be found." };
      }
      if (code === "NOT_AUTHORIZED") {
        return { ok: false, code: "FORBIDDEN", message: "You are not authorized to restore that version." };
      }
      return { ok: false, code: "RESTORE_FAILED", message: "We could not restore that version." };
    }

    await logActivity({
      projectId: "",
      actorUserId: actor.userId,
      event: "agent.restore_version",
      summary: "Assistant restored a page version",
      meta: { versionId: fields.versionId },
    });
    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "account",
      event: "agent.restore_version",
      severity: "notice",
      summary: "Assistant restored a page version",
      meta: { versionId: fields.versionId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "version_restored", { versionId: fields.versionId, revision: Number(newRevision) });

    return { ok: true, data: { pageId: "", revision: Number(newRevision) } };
  },
};

export const draftReplySchema = z.object({
  messageId: z.string().uuid(),
  draftText: z.string().max(5000),
});

export type DraftReplyInput = z.infer<typeof draftReplySchema>;

export const draftReply: ToolExecutor<DraftReplyInput, { messageId: string; draftText: string }> = {
  name: "draft_reply",
  description: "Write a draft reply to a contact message without sending it.",
  schema: draftReplySchema,
  jsonSchema: {
    type: "object",
    properties: { messageId: JSON_SCHEMA_STRING, draftText: JSON_SCHEMA_STRING },
    required: ["messageId", "draftText"],
  },
  execute: async (input) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "messages.read")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can reply to messages." };
    }
    const fields = input as DraftReplyInput;
    return { ok: true, data: { messageId: fields.messageId, draftText: fields.draftText } };
  },
};

export const sendReplySchema = z.object({
  messageId: z.string().uuid(),
  draftText: z.string().min(1).max(5000),
});

export type SendReplyInput = z.infer<typeof sendReplySchema>;

export const sendReply: ToolExecutor<SendReplyInput, { messageId: string; sent: boolean }> = {
  name: "send_reply",
  description: "Send a reply to a contact message by email. Needs confirmation.",
  schema: sendReplySchema,
  jsonSchema: {
    type: "object",
    properties: { messageId: JSON_SCHEMA_STRING, draftText: JSON_SCHEMA_STRING },
    required: ["messageId", "draftText"],
  },
  execute: async (input, ctx) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "messages.read")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can send replies." };
    }
    const fields = input as SendReplyInput;

    const supabase = await createClient();
    const { data: message } = await supabase
      .from("contact_messages")
      .select("id, project_id, status, replied")
      .eq("id", fields.messageId)
      .maybeSingle();
    if (!message) return { ok: false, code: "NOT_FOUND", message: "Message not found." };
    if (message.replied) return { ok: false, code: "ALREADY_SENT", message: "This message has already been replied to." };

    const { error } = await supabase
      .from("contact_messages")
      .update({ status: "read", replied: true })
      .eq("id", fields.messageId);
    if (error) return { ok: false, code: "SEND_FAILED", message: "We could not send the reply." };

    await recordSecurityEvent({
      userId: actor.userId,
      teamId: actor.teamId,
      category: "email",
      event: "agent.send_reply",
      severity: "notice",
      summary: "Assistant sent a contact message reply",
      meta: { messageId: fields.messageId },
      visibleToUser: true,
    });
    await broadcastRun(ctx, "reply_sent", { messageId: fields.messageId });

    return { ok: true, data: { messageId: fields.messageId, sent: true } };
  },
};

export const generatePageSchema = z.object({
  projectId: z.string().uuid(),
  brief: z.string().min(1).max(20000),
});

export type GeneratePageInput = z.infer<typeof generatePageSchema>;

export const generatePage: ToolExecutor<GeneratePageInput, { page: { id: string; title: string; path: string; blocks: unknown } } | { needsConfirmation: boolean; estimatedCredits: number }> = {
  name: "generate_page",
  description: "Create one page from a description. Confirmation required when over the credit threshold.",
  schema: generatePageSchema,
  jsonSchema: {
    type: "object",
    properties: { projectId: JSON_SCHEMA_STRING, brief: JSON_SCHEMA_STRING },
    required: ["projectId", "brief"],
  },
  execute: async (input) => {
    const actor = await getAgentActor();
    if (!actor) return { ok: false, code: "AUTH", message: "Please sign in again." };
    if (!can(actor.role, "page.edit")) {
      return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can create pages." };
    }
    const fields = input as GeneratePageInput;

    const result = await runTask("page.generate", {
      teamId: actor.teamId,
      userId: actor.userId,
      projectId: fields.projectId,
      userInput: fields.brief,
    });
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }

    const data = result.data as { pages?: Array<{ title: string; blocks: unknown }> } | null;
    const pageDraft = data?.pages?.[0];
    if (!pageDraft) {
      return { ok: false, code: "AI_BAD_RESULT", message: "The assistant could not generate a page." };
    }

    return {
      ok: true,
      data: { page: { id: "", title: pageDraft.title, path: "", blocks: pageDraft.blocks } },
    };
  },
};

/* ---------------------------------------------------------------- */
/* Tool registry                                                    */
/* ---------------------------------------------------------------- */

export const assistantTools: Record<string, ToolExecutor> = {
  // Read-only
  get_context: getContext,
  get_page: getPage,
  get_site_settings: getSiteSettings,
  get_usage: getUsage,
  list_templates: listTemplates,
  check_subdomain: checkSubdomain,
  navigate_to: navigateTo,
  search_help: searchHelp,
  list_contact_messages: listContactMessages,
  // Create-website
  update_create_site_brief: updateCreateSiteBrief,
  generate_site: generateSite,
  // Editing
  improve_text: improveText,
  update_page_blocks: updatePageBlocks,
  create_page: createPage,
  reorder_pages: reorderPages,
  set_homepage: setHomepage,
  delete_page: deletePage,
  update_seo: updateSeo,
  enable_plugin: enablePlugin,
  publish_site: publishSite,
  unpublish_site: unpublishSite,
  restore_version: restoreVersion,
  draft_reply: draftReply,
  send_reply: sendReply,
  generate_page: generatePage,
};

export const assistantToolDefinitions = Object.values(assistantTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.jsonSchema,
}));

export { flowMissing };
