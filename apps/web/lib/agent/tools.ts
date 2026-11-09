import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAddress, validateAddress } from "@/lib/address";
import { getCreateSiteDraftPreview, type CreateSiteDraftPreview } from "@/lib/agent/site-draft";
import { getAgentActor } from "@/lib/agent/auth";
import { getAssistantFeature } from "@/lib/agent/settings";
import { type ToolExecutor } from "@/lib/agent/loop";

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
  z.infer<typeof updateCreateSiteBriefSchema>,
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

export const createSiteTools: Record<string, ToolExecutor> = {
  update_create_site_brief: updateCreateSiteBrief,
  generate_site: generateSite,
};

export const createSiteToolDefinitions = Object.values(createSiteTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.jsonSchema,
}));
