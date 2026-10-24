"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";

export type ProjectSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

function clean(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export async function saveProjectSettings(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) {
    return { ok: false, error: "Please sign in again." };
  }
  if (current.team.role === "viewer") {
    return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  }

  const name = clean(formData.get("name"), 60);
  if (name.length < 2) {
    return { ok: false, error: "Please use at least 2 characters for the website name." };
  }

  const phone = clean(formData.get("phone"), 40);
  const email = clean(formData.get("email"), 200);
  const address = clean(formData.get("address"), 200);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please check the email address and try again." };
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, settings")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();

  if (!project) {
    return { ok: false, error: "We could not find that website." };
  }

  const settings =
    project.settings && typeof project.settings === "object"
      ? (project.settings as Record<string, unknown>)
      : {};
  const contact =
    settings.contact && typeof settings.contact === "object"
      ? (settings.contact as Record<string, unknown>)
      : {};

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      settings: { ...settings, contact: { ...contact, phone, email, address } },
    })
    .eq("id", projectId)
    .eq("team_id", current.team.teamId);

  if (error) {
    return { ok: false, error: "We could not save that. Please try again." };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/settings`);
  revalidatePath(`/dashboard/projects/${projectId}/pages`);
  revalidatePath(`/dashboard/projects/${projectId}/publish`);
  revalidatePath("/dashboard");

  return { ok: true };
}

export async function saveBusinessSettings(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (current.team.role === "viewer") return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  const supabase = await createClient();
  const tagline = clean(formData.get("tagline"), 120);
  const timezone = clean(formData.get("timezone"), 64) || "UTC";
  const themeColor = clean(formData.get("theme_color"), 16);
  const twitterHandle = clean(formData.get("twitter_handle"), 40);
  const addressPartsRaw = clean(formData.get("address_parts"), 2000);
  let addressParts = {};
  try { if (addressPartsRaw) addressParts = JSON.parse(addressPartsRaw); } catch {}
  const { data: project } = await supabase
    .from("projects")
    .select("id, settings")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!project) return { ok: false, error: "We could not find that website." };
  const settings =
    project.settings && typeof project.settings === "object"
      ? (project.settings as Record<string, unknown>)
      : {};
  const { error } = await supabase
    .from("projects")
    .update({ settings: { ...settings, tagline, timezone, themeColor, twitterHandle, addressParts } })
    .eq("id", projectId)
    .eq("team_id", current.team.teamId);
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/settings/business`);
  return { ok: true };
}

export async function pauseWebsite(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (current.team.role === "viewer") return { ok: false, error: "Only owners and admins can pause this website." };
  const supabase = await createClient();
  const enabled = formData.get("enabled") === "true";
  const title = clean(formData.get("title"), 60) || "We will be back soon";
  const text = clean(formData.get("text"), 300) || "This website is being updated. Please check again in a little while.";
  const { error } = await supabase
    .from("project_settings")
    .update({ maintenance: enabled ? { enabled: true, title, text, since: new Date().toISOString() } : { enabled: false } })
    .eq("project_id", projectId);
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath(`/dashboard/projects/${projectId}/settings/publishing`);
  return { ok: true };
}
