"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { recipientVerificationEmail } from "@get-on/email";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeam } from "@/lib/team";
import { sendEmail, isSuppressed } from "@/lib/email/send";
import { parseContactSettings, type ContactSettings } from "@/lib/contact/settings";
import { invalidateQuickFind } from "@/lib/project-activity";

export type PluginResult = { ok: true; token?: string } | { ok: false; error: string };

function pluginPath(projectId: string, suffix = "") {
  return `/dashboard/projects/${projectId}/plugins${suffix}`;
}

function recipientPath(projectId: string) {
  return `/dashboard/projects/${projectId}/plugins/contact`;
}

function codeOf(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  const known = [
    "NOT_ALLOWED",
    "PLUGIN_NOT_AVAILABLE",
    "PLUGIN_NOT_ON_PLAN",
    "PLUGIN_LIMIT_REACHED",
    "PLUGIN_ALREADY_ENABLED",
    "RECIPIENT_LIMIT_REACHED",
    "RECIPIENT_EXISTS",
    "RECIPIENT_SUPPRESSED",
  ];
  return known.find((code) => message.includes(code)) ?? "UNKNOWN";
}

async function guard(projectId: string): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; teamId: string }
  | { ok: false; error: string }
> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (current.team.role !== "owner" && current.team.role !== "admin") {
    return { ok: false, error: "NOT_ALLOWED" };
  }
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, team_id")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  return { ok: true, supabase, teamId: String(project.team_id) };
}

export async function enablePlugin(projectId: string, pluginId: string): Promise<PluginResult> {
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;
  const { error } = await allowed.supabase.rpc("enable_plugin", {
    p_project_id: projectId,
    p_plugin_id: pluginId,
  });
  if (error) return { ok: false, error: codeOf(error) };
  invalidateQuickFind(allowed.teamId);
  revalidatePath(pluginPath(projectId));
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function disablePlugin(projectId: string, pluginId: string): Promise<PluginResult> {
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;
  const { error } = await allowed.supabase.rpc("disable_plugin", {
    p_project_id: projectId,
    p_plugin_id: pluginId,
  });
  if (error) return { ok: false, error: codeOf(error) };
  invalidateQuickFind(allowed.teamId);
  revalidatePath(pluginPath(projectId));
  revalidatePath(pluginPath(projectId, "/contact"));
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function confirmUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGIN || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/confirm-recipient?token=${encodeURIComponent(token)}`;
}

async function sendVerification(
  projectId: string,
  email: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  const rendered = recipientVerificationEmail({
    site: project?.name ?? "your website",
    ownerName: project?.name ?? "The website owner",
    confirmUrl: confirmUrl(token),
  });
  const result = await sendEmail({
    to: email,
    kind: "recipient_verification",
    relatedType: "contact_project",
    relatedId: projectId,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
  if (result.status === "failed") return { ok: false, error: "UNKNOWN" };
  return { ok: true };
}

export async function addRecipient(
  projectId: string,
  rawEmail: string,
): Promise<PluginResult> {
  const email = normaliseEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("contact_recipients")
    .select("id")
    .eq("project_id", projectId)
    .eq("email", email)
    .maybeSingle();
  if (existing) return { ok: false, error: "RECIPIENT_EXISTS" };
  if (await isSuppressed(admin, email)) return { ok: false, error: "RECIPIENT_SUPPRESSED" };

  const { count } = await admin
    .from("contact_recipients")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((count ?? 0) >= 3) return { ok: false, error: "RECIPIENT_LIMIT_REACHED" };

  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("contact_recipients").insert({
    project_id: projectId,
    email,
    token_hash: tokenHash(token),
    token_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false, error: codeOf(error) };

  const sent = await sendVerification(projectId, email, token);
  revalidatePath(recipientPath(projectId));
  return sent.ok ? { ok: true } : sent;
}

export async function resendRecipient(
  projectId: string,
  recipientId: string,
): Promise<PluginResult> {
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;

  const admin = createAdminClient();
  const { data: recipient } = await admin
    .from("contact_recipients")
    .select("id, email, verified_at")
    .eq("id", recipientId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!recipient) return { ok: false, error: "UNKNOWN" };
  if (recipient.verified_at) return { ok: false, error: "RECIPIENT_EXISTS" };

  const token = randomBytes(32).toString("base64url");
  const { error } = await admin
    .from("contact_recipients")
    .update({
      token_hash: tokenHash(token),
      token_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", recipientId);
  if (error) return { ok: false, error: codeOf(error) };

  const sent = await sendVerification(projectId, recipient.email, token);
  return sent.ok ? { ok: true } : sent;
}

export async function removeRecipient(
  projectId: string,
  recipientId: string,
): Promise<PluginResult> {
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;
  const admin = createAdminClient();
  const { error } = await admin
    .from("contact_recipients")
    .delete()
    .eq("id", recipientId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: codeOf(error) };
  revalidatePath(recipientPath(projectId));
  return { ok: true };
}

export async function saveContactSettings(
  projectId: string,
  settings: ContactSettings,
): Promise<PluginResult> {
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;
  const parsed = parseContactSettings(settings);
  const { error } = await allowed.supabase.from("project_settings").upsert(
    { project_id: projectId, contact_settings: parsed },
    { onConflict: "project_id" },
  );
  if (error) return { ok: false, error: "UNKNOWN" };
  revalidatePath(recipientPath(projectId));
  return { ok: true };
}

export async function sendTestAutoreply(projectId: string): Promise<PluginResult> {
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;
  const admin = createAdminClient();
  const [{ data: settingsRow }, { data: project }, { data: team }] = await Promise.all([
    allowed.supabase
      .from("project_settings")
      .select("contact_settings")
      .eq("project_id", projectId)
      .maybeSingle(),
    allowed.supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    allowed.supabase.from("teams").select("owner_id").eq("id", allowed.teamId).maybeSingle(),
  ]);
  if (!team?.owner_id) return { ok: false, error: "UNKNOWN" };
  const auth = await admin.auth.admin.getUserById(String(team.owner_id));
  const to = auth?.data?.user?.email;
  if (!to) return { ok: false, error: "UNKNOWN" };
  const settings = parseContactSettings(settingsRow?.contact_settings);
  const { contactAutoreplyEmail } = await import("@get-on/email");
  const rendered = contactAutoreplyEmail({
    visitorName: "Sam",
    businessName: project?.name ?? "your business",
    subject: settings.autoReply.subject,
    body: settings.autoReply.body,
  });
  const result = await sendEmail({
    to,
    kind: "contact_autoreply",
    relatedType: "contact_project",
    relatedId: projectId,
    subject: `[Test] ${rendered.subject}`,
    text: rendered.text,
    html: rendered.html,
  });
  return result.status === "failed" ? { ok: false, error: "UNKNOWN" } : { ok: true };
}

export async function deleteAllMessages(projectId: string, word: string): Promise<PluginResult> {
  if (word.trim().toLowerCase() !== "delete") {
    return { ok: false, error: "Please type delete to confirm." };
  }
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;
  const admin = createAdminClient();
  const { error } = await admin.from("contact_messages").delete().eq("project_id", projectId);
  if (error) return { ok: false, error: "UNKNOWN" };
  revalidatePath(`/dashboard/projects/${projectId}/messages`);
  revalidatePath(recipientPath(projectId));
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateMessages(
  projectId: string,
  ids: string[],
  patch: { status?: "new" | "read" | "archived" | "spam"; replied?: boolean },
): Promise<PluginResult> {
  if (ids.length === 0) return { ok: true };
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;
  const update: Record<string, unknown> = {};
  if (patch.status) {
    update.status = patch.status;
    update.read_at = patch.status === "new" ? null : new Date().toISOString();
  }
  if (typeof patch.replied === "boolean") update.replied = patch.replied;
  if (Object.keys(update).length === 0) return { ok: true };
  const { error } = await allowed.supabase
    .from("contact_messages")
    .update(update)
    .eq("project_id", projectId)
    .in("id", ids);
  if (error) return { ok: false, error: "UNKNOWN" };
  revalidatePath(`/dashboard/projects/${projectId}/messages`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMessages(
  projectId: string,
  ids: string[],
): Promise<PluginResult> {
  if (ids.length === 0) return { ok: true };
  const allowed = await guard(projectId);
  if (!allowed.ok) return allowed;
  const admin = createAdminClient();
  const { error } = await admin
    .from("contact_messages")
    .delete()
    .eq("project_id", projectId)
    .in("id", ids);
  if (error) return { ok: false, error: "UNKNOWN" };
  revalidatePath(`/dashboard/projects/${projectId}/messages`);
  revalidatePath("/dashboard");
  return { ok: true };
}
