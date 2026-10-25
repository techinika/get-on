import type { AiModel, SkillBlock } from "@get-on/ai";
import { MODEL_SEEDS } from "@get-on/ai";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type AiSettings = {
  enabled: boolean;
  creditNeurons: number;
  dailyCapCredits: number;
  freeGrantCredits: number;
  maxPromptChars: number;
  moderationEnabled: boolean;
  imagesEnabled: boolean;
  payloadRetentionDays: number;
  gatewayId: string | null;
  defaultLanguage: string;
};

export type BrandContext = {
  brandVoice: Record<string, unknown>;
  businessFacts: Array<{ label: string; value: string }>;
  businessType: string | null;
  templateSlug: string | null;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  creditNeurons: 100,
  dailyCapCredits: 5000,
  freeGrantCredits: 25,
  maxPromptChars: 20000,
  moderationEnabled: true,
  imagesEnabled: false,
  payloadRetentionDays: 30,
  gatewayId: null,
  defaultLanguage: "en",
};

function numeric(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function loadAiSettings(admin: Admin): Promise<AiSettings> {
  const { data } = await admin
    .from("ai_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (!data) return DEFAULT_AI_SETTINGS;
  return {
    enabled: data.enabled !== false,
    creditNeurons: numeric(data.credit_neurons, DEFAULT_AI_SETTINGS.creditNeurons),
    dailyCapCredits: numeric(
      data.daily_cap_credits,
      DEFAULT_AI_SETTINGS.dailyCapCredits,
    ),
    freeGrantCredits: numeric(
      data.free_grant_credits,
      DEFAULT_AI_SETTINGS.freeGrantCredits,
    ),
    maxPromptChars: numeric(
      data.max_prompt_chars,
      DEFAULT_AI_SETTINGS.maxPromptChars,
    ),
    moderationEnabled: data.moderation_enabled !== false,
    imagesEnabled: data.images_enabled === true,
    payloadRetentionDays: numeric(
      data.payload_retention_days,
      DEFAULT_AI_SETTINGS.payloadRetentionDays,
    ),
    gatewayId: typeof data.gateway_id === "string" ? data.gateway_id : null,
    defaultLanguage:
      typeof data.default_language === "string"
        ? data.default_language
        : DEFAULT_AI_SETTINGS.defaultLanguage,
  };
}

function toModel(row: Record<string, unknown>): AiModel {
  return {
    id: String(row.id),
    provider: String(row.provider ?? "workers-ai"),
    modelId: String(row.model_id),
    purposes: Array.isArray(row.purposes)
      ? (row.purposes as AiModel["purposes"])
      : [],
    neuronsPerMInput:
      row.neurons_per_m_input === null
        ? null
        : numeric(row.neurons_per_m_input, 0),
    neuronsPerMOutput:
      row.neurons_per_m_output === null
        ? null
        : numeric(row.neurons_per_m_output, 0),
    neuronsPerImage:
      row.neurons_per_image === null
        ? null
        : numeric(row.neurons_per_image, 0),
    contextTokens: numeric(row.context_tokens, 1),
    maxOutputTokens: numeric(row.max_output_tokens, 0),
    supportsJson: row.supports_json === true,
    supportsVision: row.supports_vision === true,
    enabled: row.enabled !== false,
    fallbackId:
      typeof row.fallback_id === "string" ? row.fallback_id : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
  };
}

export async function loadAiModels(admin: Admin): Promise<AiModel[]> {
  const { data } = await admin
    .from("ai_models")
    .select("*")
    .eq("enabled", true)
    .order("id");
  if (!data || data.length === 0) return MODEL_SEEDS;
  return data.map((row) => toModel(row as Record<string, unknown>));
}

export async function loadTeamBalance(
  admin: Admin,
  teamId: string,
): Promise<{ total: number; buckets: unknown[] }> {
  const { data } = await admin.rpc("ai_balance", { p_team: teamId });
  const value =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};
  return {
    total: numeric(value.total, 0),
    buckets: Array.isArray(value.buckets) ? value.buckets : [],
  };
}

export async function loadUsedThisCycle(
  admin: Admin,
  teamId: string,
  userId: string,
): Promise<number> {
  const { data } = await admin.rpc("credits_used_in_cycle", {
    p_team: teamId,
    p_user: userId,
  });
  return numeric(data, 0);
}

export async function loadMemberCap(
  admin: Admin,
  teamId: string,
  userId: string,
): Promise<number | null> {
  const { data } = await admin
    .from("credit_member_caps")
    .select("monthly_credits")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? numeric(data.monthly_credits, 0) : null;
}

export async function loadDailyUsage(
  admin: Admin,
  teamId: string,
): Promise<{ credits: number; requests: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("ai_usage_daily")
    .select("credits, requests")
    .eq("day", day)
    .eq("team_id", teamId)
    .maybeSingle();
  return {
    credits: numeric(data?.credits, 0),
    requests: numeric(data?.requests, 0),
  };
}

export async function loadPlatformUsage(
  admin: Admin,
): Promise<{ credits: number; requests: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("ai_usage_platform_daily")
    .select("credits, requests")
    .eq("day", day)
    .maybeSingle();
  return {
    credits: numeric(data?.credits, 0),
    requests: numeric(data?.requests, 0),
  };
}

export async function loadBrandContext(
  admin: Admin,
  projectId: string | null,
): Promise<BrandContext> {
  if (!projectId) {
    return {
      brandVoice: {},
      businessFacts: [],
      businessType: null,
      templateSlug: null,
    };
  }

  const [{ data: project }, { data: settings }] = await Promise.all([
    admin.from("projects").select("settings").eq("id", projectId).maybeSingle(),
    admin
      .from("project_settings")
      .select("brand_voice, business_facts")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  const projectSettings =
    project?.settings && typeof project.settings === "object"
      ? (project.settings as Record<string, unknown>)
      : {};
  const brandVoice =
    settings?.brand_voice && typeof settings.brand_voice === "object"
      ? (settings.brand_voice as Record<string, unknown>)
      : {};
  const businessFacts = Array.isArray(settings?.business_facts)
    ? (settings.business_facts as Array<{ label?: unknown; value?: unknown }>)
        .filter((fact) => fact && typeof fact === "object")
        .map((fact) => ({
          label: String(fact.label ?? "").slice(0, 40),
          value: String(fact.value ?? "").slice(0, 120),
        }))
        .filter((fact) => fact.label && fact.value)
    : [];

  return {
    brandVoice,
    businessFacts,
    businessType:
      typeof projectSettings.businessType === "string"
        ? projectSettings.businessType
        : null,
    templateSlug:
      typeof projectSettings.templateSlug === "string"
        ? projectSettings.templateSlug
        : null,
  };
}

export async function loadSkills(
  admin: Admin,
  taskId: string,
  context: BrandContext,
  language: string,
): Promise<SkillBlock[]> {
  const scopes = ["global", "task", "language"];
  if (context.businessType) scopes.push("business_type");
  if (context.templateSlug) scopes.push("template");

  const { data: packs } = await admin
    .from("skill_packs")
    .select("id, scope, scope_value, priority, active_version_id")
    .eq("status", "active")
    .not("active_version_id", "is", null)
    .in("scope", scopes);
  if (!packs || packs.length === 0) return [];

  const selected = packs.filter((pack) => {
    if (pack.scope === "global") return true;
    if (pack.scope === "task") return pack.scope_value === taskId;
    if (pack.scope === "language") return pack.scope_value === language;
    if (pack.scope === "business_type") {
      return pack.scope_value === context.businessType;
    }
    if (pack.scope === "template") {
      return pack.scope_value === context.templateSlug;
    }
    return false;
  });
  if (selected.length === 0) return [];

  const versionIds = selected
    .map((pack) => pack.active_version_id)
    .filter((id): id is string => typeof id === "string");
  const { data: versions } = await admin
    .from("skill_pack_versions")
    .select("id, pack_id, version, content")
    .in("id", versionIds);

  const byPack = new Map(
    (versions ?? []).map((version) => [version.pack_id, version]),
  );

  return selected
    .map((pack) => {
      const version = byPack.get(pack.id);
      if (!version) return null;
      return {
        id: pack.id,
        version: numeric(version.version, 1),
        priority: numeric(pack.priority, 100),
        scope: String(pack.scope),
        text: String(version.content ?? ""),
      } satisfies SkillBlock;
    })
    .filter((skill): skill is SkillBlock => skill !== null);
}

export async function ensureFreeGrant(
  admin: Admin,
  teamId: string,
  userId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("free_ai_grant_at")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.free_ai_grant_at) return;

  const { data: claimed, error: claimError } = await admin
    .from("profiles")
    .update({ free_ai_grant_at: new Date().toISOString() })
    .eq("id", userId)
    .is("free_ai_grant_at", null)
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) return;

  const { error } = await admin.rpc("grant_credits", {
    p_team: teamId,
    p_kind: "free_grant",
    p_amount: amount,
    p_expires: null,
    p_source: `free:${userId}`,
    p_note: "Free AI credits to start",
  });
  if (error) {
    await admin
      .from("profiles")
      .update({ free_ai_grant_at: null })
      .eq("id", userId);
    throw error;
  }
}
