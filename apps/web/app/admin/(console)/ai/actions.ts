"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireStaffAction,
  saveAiSettings as saveAiSettingsRpc,
  toggleAiModel as toggleAiModelRpc,
} from "@/lib/admin";

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

export async function saveAiSettings(form: FormData) {
  await requireStaffAction("ai.settings");

  const gatewayId = String(form.get("gateway_id") ?? "").trim();
  if (gatewayId.length > 120) invalid("GATEWAY");

  const language = String(form.get("default_language") ?? "en")
    .trim()
    .toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) invalid("LANGUAGE");

  const enabled = form.get("enabled") === "on";
  const imagesEnabled = form.get("images_enabled") === "on";
  const moderationEnabled = form.get("moderation_enabled") === "on";
  const creditNeurons = intField(form, "credit_neurons", 1, 100_000, "CREDIT_NEURONS");
  const dailyCapCredits = intField(form, "daily_cap_credits", 0, 1_000_000, "DAILY_CAP");
  const freeGrantCredits = intField(form, "free_grant_credits", 0, 10_000, "FREE_GRANT");
  const maxPromptChars = intField(form, "max_prompt_chars", 100, 200_000, "PROMPT_CHARS");
  const payloadRetentionDays = intField(form, "payload_retention_days", 1, 365, "RETENTION");

  try {
    await saveAiSettingsRpc({
      enabled,
      imagesEnabled,
      moderationEnabled,
      creditNeurons,
      dailyCapCredits,
      freeGrantCredits,
      maxPromptChars,
      payloadRetentionDays,
      gatewayId: gatewayId || null,
      defaultLanguage: language,
    });
  } catch {
    invalid("SAVE_FAILED");
  }

  revalidatePath("/admin/ai");
  revalidatePath("/dashboard/ai");
  redirect("/admin/ai?saved=settings");
}

export async function toggleAiModel(form: FormData) {
  await requireStaffAction("ai.settings");
  const id = String(form.get("id") ?? "").trim();
  const enabled = form.get("enabled") === "true";
  if (!id || id.length > 120) invalid("MODEL");

  try {
    await toggleAiModelRpc(id, enabled);
  } catch {
    invalid("MODEL_SAVE_FAILED");
  }

  revalidatePath("/admin/ai");
  redirect("/admin/ai?saved=model");
}
