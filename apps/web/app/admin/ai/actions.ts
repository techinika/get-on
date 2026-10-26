"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { getShellData } from "@/lib/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const data = await getShellData();
  if (!data || !isAdminEmail(data.user.email)) throw new Error("NOT_FOUND");
  return data.user;
}

function invalid(code: string): never {
  redirect(`/admin/ai?error=${code}`);
}

function intField(
  form: FormData,
  key: string,
  min: number,
  max: number,
  code: string,
): number {
  const value = Number(form.get(key));
  if (!Number.isInteger(value) || value < min || value > max) invalid(code);
  return value;
}

async function audit(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await admin.from("admin_audit_log").insert({
    admin_email: email,
    action,
    project_id: null,
    metadata,
  });
  if (error) console.error("[admin-ai] could not write audit log", error);
}

export async function saveAiSettings(form: FormData) {
  const user = await requireAdmin();
  const admin = createAdminClient();

  const gatewayId = String(form.get("gateway_id") ?? "").trim();
  if (gatewayId.length > 120) invalid("GATEWAY");

  const language = String(form.get("default_language") ?? "en")
    .trim()
    .toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) invalid("LANGUAGE");

  const values = {
    enabled: form.get("enabled") === "on",
    images_enabled: form.get("images_enabled") === "on",
    moderation_enabled: form.get("moderation_enabled") === "on",
    credit_neurons: intField(form, "credit_neurons", 1, 100_000, "CREDIT_NEURONS"),
    daily_cap_credits: intField(form, "daily_cap_credits", 0, 1_000_000, "DAILY_CAP"),
    free_grant_credits: intField(form, "free_grant_credits", 0, 10_000, "FREE_GRANT"),
    max_prompt_chars: intField(form, "max_prompt_chars", 100, 200_000, "PROMPT_CHARS"),
    payload_retention_days: intField(form, "payload_retention_days", 1, 365, "RETENTION"),
    gateway_id: gatewayId || null,
    default_language: language,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("ai_settings").update(values).eq("id", true);
  if (error) {
    console.error("[admin-ai] could not save settings", error);
    invalid("SAVE_FAILED");
  }

  await audit(admin, user.email, "ai_settings_update", {
    enabled: values.enabled,
    imagesEnabled: values.images_enabled,
    moderationEnabled: values.moderation_enabled,
    dailyCapCredits: values.daily_cap_credits,
    freeGrantCredits: values.free_grant_credits,
  });

  revalidatePath("/admin/ai");
  revalidatePath("/dashboard/ai");
  redirect("/admin/ai?saved=settings");
}

export async function toggleAiModel(form: FormData) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const id = String(form.get("id") ?? "").trim();
  const enabled = form.get("enabled") === "true";
  if (!id || id.length > 120) invalid("MODEL");

  const { data, error } = await admin
    .from("ai_models")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) invalid("MODEL_SAVE_FAILED");

  await audit(admin, user.email, enabled ? "ai_model_enable" : "ai_model_disable", {
    modelId: id,
  });

  revalidatePath("/admin/ai");
  redirect("/admin/ai?saved=model");
}
