"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { logActivity } from "@/lib/activity";
import { logTeamActivity } from "@/lib/activity/log";
import { can } from "@/lib/permissions";
import { getQuota } from "@/lib/quotas";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/plans/constants";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";
import {
  newTransferToken,
  normalizeTransferEmail,
  sendTransferEmail,
  transferLink,
  TRANSFER_DAYS,
} from "@/lib/team/transfers";
import {
  patchLivePointer,
  pauseFromSettings,
  redirectsFromRows,
  type RedirectRow,
} from "@/lib/publishing/live-pointer";

export type ProjectSettingsResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type SitemapResult =
  | { ok: true; xml: string; message: string }
  | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

function clean(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function canEdit(role: string) {
  return can(role as "owner" | "admin" | "editor" | "viewer", "page.edit");
}

function invalidate(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}/settings`, "layout");
  revalidatePath(`/dashboard/projects/${projectId}/visitors`);
  revalidatePath("/dashboard");
}

async function findProject(
  supabase: Supabase,
  projectId: string,
  teamId: string,
) {
  const { data } = await supabase
    .from("projects")
    .select("id, name, subdomain, primary_host, status, deleted_at")
    .eq("id", projectId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  return data;
}

async function updateSettings(
  supabase: Supabase,
  projectId: string,
  values: Record<string, unknown>,
) {
  return supabase
    .from("project_settings")
    .upsert({ project_id: projectId, ...values }, { onConflict: "project_id" });
}

export async function saveProjectSettings(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
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
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const { data: row } = await supabase
    .from("projects")
    .select("settings")
    .eq("id", projectId)
    .maybeSingle();
  const settings =
    row?.settings && typeof row.settings === "object"
      ? (row.settings as Record<string, unknown>)
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
  if (error) return { ok: false, error: "We could not save that. Please try again." };

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "project.details_updated",
    summary: "Website details were updated",
  });
  invalidate(projectId);
  return { ok: true };
}

export async function saveBusinessSettings(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  }

  const name = clean(formData.get("name"), 60);
  if (name && name.length < 2) {
    return { ok: false, error: "Please use at least 2 characters for the business name." };
  }
  const tagline = clean(formData.get("tagline"), 120);
  const timezone = clean(formData.get("timezone"), 64) || "UTC";
  const themeColor = clean(formData.get("theme_color"), 16);
  if (themeColor && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) {
    return { ok: false, error: "Please choose a browser bar colour like #1a73e8." };
  }
  const twitterHandle = clean(formData.get("twitter_handle"), 40);
  const addressParts = {
    street: clean(formData.get("street"), 120),
    city: clean(formData.get("city"), 80),
    region: clean(formData.get("region"), 80),
    postal: clean(formData.get("postal"), 24),
    country: clean(formData.get("country"), 2).toUpperCase(),
  };

  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  if (name && name !== project.name) {
    const { error } = await supabase
      .from("projects")
      .update({ name })
      .eq("id", projectId)
      .eq("team_id", current.team.teamId);
    if (error) return { ok: false, error: "We could not save that. Please try again." };
  }

  const { error } = await updateSettings(supabase, projectId, {
    tagline,
    timezone,
    theme_color: themeColor || null,
    twitter_handle: twitterHandle || null,
    address_parts: addressParts,
  });
  if (error) return { ok: false, error: "We could not save that. Please try again." };

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "settings.business_updated",
    summary: "Business details were updated",
  });
  invalidate(projectId);
  return { ok: true };
}

export async function pauseWebsite(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "site.settings")) {
    return { ok: false, error: "Only owners and admins can pause this website." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const enabled = formData.get("enabled") === "true";
  const title = clean(formData.get("title"), 60) || "We will be back soon";
  const text =
    clean(formData.get("text"), 300) ||
    "This website is being updated. Please check again in a little while.";

  const maintenance = enabled
    ? { enabled: true, title, text, since: new Date().toISOString() }
    : { enabled: false };
  const { error } = await updateSettings(supabase, projectId, {
    maintenance,
  });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  await syncPointer(project.subdomain, {
    pause: pauseFromSettings(maintenance),
  });

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: enabled ? "publish.paused" : "publish.resumed",
    summary: enabled ? "Website was paused" : "Website was resumed",
  });
  invalidate(projectId);
  return { ok: true };
}

export async function saveCustom404(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const title = clean(formData.get("not_found_title"), 60) || "Page not found";
  const text =
    clean(formData.get("not_found_text"), 200) ||
    "That page does not exist. It may have been moved or removed.";
  const button = clean(formData.get("not_found_button"), 30) || "Go to the homepage";

  const { error } = await updateSettings(supabase, projectId, {
    custom_404: { title, text, button },
  });
  if (error) return { ok: false, error: "We could not save that. Please try again." };

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "settings.not_found_updated",
    summary: "Page-not-found message was updated",
  });
  invalidate(projectId);
  return { ok: true };
}

export async function saveSearchSettings(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const title = clean(formData.get("site-title"), 60);
  const description = clean(formData.get("site-desc"), 160);
  const titleFormat = clean(formData.get("title-format"), 40) || "{page} | {site}";
  const twitterHandle = clean(formData.get("twitter"), 40);
  const indexing = formData.get("indexing") === "true";

  const { error } = await updateSettings(supabase, projectId, {
    seo_site_title: title || null,
    seo_description: description || null,
    seo_title_format: titleFormat,
    twitter_handle: twitterHandle || null,
    search_indexing: indexing,
  });
  if (error) return { ok: false, error: "We could not save that. Please try again." };

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "settings.search_updated",
    summary: "Search appearance was updated",
  });
  invalidate(projectId);
  return { ok: true };
}

export async function saveSitemapSettings(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const gscTag = clean(formData.get("gsc-tag"), 200);
  const gscFile = clean(formData.get("gsc-file"), 60);
  const bing = clean(formData.get("bing"), 40);
  const includeImages = formData.get("include-images") === "true";

  const { error } = await updateSettings(supabase, projectId, {
    verification: { gscTag, gscFile, bing },
    sitemap_include_images: includeImages,
  });
  if (error) return { ok: false, error: "We could not save that. Please try again." };

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "settings.sitemap_updated",
    summary: "Sitemap and Google settings were updated",
  });
  invalidate(projectId);
  return { ok: true };
}

export async function previewSitemap(projectId: string): Promise<SitemapResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const { data: pages } = await supabase
    .from("pages")
    .select("path, is_hidden, hide_from_search")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const base = primaryAddress(readPublishConfig(), project.subdomain, project.primary_host);
  const entries = (pages ?? []).filter(
    (page) => !page.is_hidden && page.hide_from_search !== true,
  );
  if (entries.length === 0) {
    return { ok: false, error: "Add a page before you check the sitemap." };
  }
  const urls = entries
    .map((page) => {
      const path = page.path === "/" ? "" : page.path;
      return `  <url><loc>${escapeXml(`${base}${path}`)}</loc></url>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return { ok: true, xml, message: `${entries.length} page${entries.length === 1 ? "" : "s"}` };
}

export async function checkSitemap(projectId: string): Promise<SitemapResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };
  if (project.status !== "published") {
    return { ok: false, error: "Publish your website first, then check the sitemap." };
  }

  const url = `${primaryAddress(readPublishConfig(), project.subdomain, project.primary_host)}/sitemap.xml`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const xml = await response.text();
    const count = (xml.match(/<url>/g) ?? []).length;
    const ok = response.ok && xml.includes("<urlset");
    await updateSettings(supabase, projectId, {
      sitemap_checked_at: new Date().toISOString(),
      sitemap_check: { ok, status: response.status, count },
    });
    if (!ok) {
      return {
        ok: false,
        error: `The sitemap did not load (status ${response.status}). Publish again and try once more.`,
      };
    }
    return {
      ok: true,
      xml,
      message: `The sitemap is working and lists ${count} page${count === 1 ? "" : "s"}.`,
    };
  } catch {
    return {
      ok: false,
      error: "We could not reach the sitemap. Publish your website, then try again.",
    };
  }
}

export async function saveAnalyticsSettings(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const visitors = formData.get("visitors") === "true";
  const gaEnabled = formData.get("ga-enabled") === "true";
  const gaId = clean(formData.get("ga-id"), 40).toUpperCase();
  const gaConsent = clean(formData.get("ga-consent"), 10) || "ask";

  if (gaEnabled && !/^G-[A-Z0-9]{4,20}$/.test(gaId)) {
    return { ok: false, error: "Enter the Measurement ID from Google Analytics, like G-ABC123XYZ." };
  }
  if (gaConsent !== "ask" && gaConsent !== "all") {
    return { ok: false, error: "Choose when Google Analytics may load." };
  }

  const { error } = await updateSettings(supabase, projectId, {
    stats_enabled: visitors,
    ga: {
      enabled: gaEnabled,
      measurementId: gaId || null,
      consent: gaConsent,
    },
  });
  if (error) return { ok: false, error: "We could not save that. Please try again." };

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "settings.analytics_updated",
    summary: "Visitor and analytics settings were updated",
  });
  invalidate(projectId);
  return { ok: true };
}

function normalisePath(value: string): string {
  let path = value.trim().toLowerCase();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

async function syncPointer(
  subdomain: string,
  patch: Parameters<typeof patchLivePointer>[1],
) {
  try {
    await patchLivePointer(subdomain, patch);
  } catch (error) {
    console.error("[settings] could not update the live website", error);
  }
}

async function syncRedirects(
  supabase: Supabase,
  projectId: string,
  subdomain: string,
) {
  const { data } = await supabase
    .from("redirects")
    .select("from_path, to_value, code")
    .eq("project_id", projectId);
  await syncPointer(subdomain, {
    redirects: redirectsFromRows((data ?? []) as RedirectRow[]),
  });
}

function parseRedirectTarget(value: string):
  | { toType: "path" | "url"; toValue: string }
  | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\/[^\s]+$/i.test(raw)) {
    try {
      const url = new URL(raw);
      return { toType: "url", toValue: url.toString() };
    } catch {
      return null;
    }
  }
  if (raw.startsWith("/") || /^[a-z0-9][a-z0-9/_-]*$/i.test(raw)) {
    return { toType: "path", toValue: normalisePath(raw) };
  }
  return null;
}

export async function saveRedirect(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const from = normalisePath(clean(formData.get("from"), 200));
  const target = parseRedirectTarget(clean(formData.get("to"), 500));
  if (!target) return { ok: false, error: "Add a new address that starts with / or a full https:// link." };
  if (from.length > 200) return { ok: false, error: "That old address is too long." };
  if (!/^\/[a-z0-9/_.~%-]*$/i.test(from) || from.includes("..")) {
    return { ok: false, error: "Use letters, numbers, dashes and slashes only." };
  }
  if (target.toType === "path" && target.toValue === from) {
    return { ok: false, error: "The old and new addresses are the same." };
  }

  const limits = PLANS[current.team.planId] ?? PLANS.free;
  const { data: rows, error: readError } = await supabase
    .from("redirects")
    .select("id, from_path, to_type, to_value")
    .eq("project_id", projectId);
  if (readError) return { ok: false, error: "We could not check your moved pages. Please try again." };
  if ((rows ?? []).length >= limits.redirects_max) {
    return {
      ok: false,
      error: `Your plan includes ${limits.redirects_max} moved pages. Remove one before adding another.`,
    };
  }
  if ((rows ?? []).some((row) => row.from_path === from)) {
    return { ok: false, error: "That old address already has a moved page." };
  }

  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("project_id", projectId)
    .eq("path", from)
    .maybeSingle();
  if (page) {
    return { ok: false, error: "That address is already one of your pages." };
  }

  if (target.toType === "path") {
    const chain = new Map(
      (rows ?? [])
        .filter((row) => row.to_type === "path" && row.to_value)
        .map((row) => [row.from_path, row.to_value as string]),
    );
    let next = target.toValue;
    const seen = new Set<string>([from]);
    while (next) {
      if (seen.has(next)) {
        return { ok: false, error: "That would make a loop between moved pages." };
      }
      seen.add(next);
      next = chain.get(next) ?? "";
    }
  }

  const { error } = await supabase.from("redirects").insert({
    project_id: projectId,
    from_path: from,
    to_type: target.toType,
    to_value: target.toValue,
    code: 301,
    auto: false,
    created_by: current.user.id,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That old address already has a moved page." };
    }
    return { ok: false, error: "We could not save that. Please try again." };
  }

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "redirect.added",
    summary: `Moved ${from} to ${target.toValue}`,
  });
  await syncRedirects(supabase, projectId, project.subdomain);
  invalidate(projectId);
  return { ok: true };
}

export async function deleteRedirect(
  projectId: string,
  id: string,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return { ok: false, error: "Only editors, admins and the owner can change website settings." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const { data: redirect } = await supabase
    .from("redirects")
    .select("from_path")
    .eq("project_id", projectId)
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase
    .from("redirects")
    .delete()
    .eq("project_id", projectId)
    .eq("id", id);
  if (error) return { ok: false, error: "We could not remove that. Please try again." };

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "redirect.removed",
    summary: redirect?.from_path
      ? `Removed the moved page for ${redirect.from_path}`
      : "Removed a moved page",
  });
  await syncRedirects(supabase, projectId, project.subdomain);
  invalidate(projectId);
  return { ok: true };
}

export async function createBackup(
  projectId: string,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return { ok: false, error: "Only editors, admins and the owner can create backups." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };
  return {
    ok: false,
    error: "Manual backups are not switched on for this website yet.",
  };
}

export async function moveProjectToTeam(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "site.transfer")) {
    return { ok: false, error: "Only owners and admins can move this website." };
  }
  const targetTeamId = clean(formData.get("team_id"), 60);
  if (!targetTeamId || targetTeamId === current.team.teamId) {
    return { ok: false, error: "Choose a different team." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const [{ data: membership }, { data: targetTeam }] = await Promise.all([
    supabase
      .from("team_members")
      .select("role")
      .eq("team_id", targetTeamId)
      .eq("user_id", current.user.id)
      .maybeSingle(),
    supabase.from("teams").select("id, plan_id").eq("id", targetTeamId).maybeSingle(),
  ]);
  if (!targetTeam || !membership || !can(membership.role as "owner" | "admin" | "editor" | "viewer", "site.create")) {
    return { ok: false, error: "You can only move a website to a team you own or manage." };
  }

  const plan = PLAN_BY_ID[(targetTeam.plan_id as PlanId) ?? "free"] ?? PLAN_BY_ID.free;
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("team_id", targetTeamId)
    .is("deleted_at", null);
  if (plan.maxWebsites !== null && (count ?? 0) >= plan.maxWebsites) {
    return { ok: false, error: "That team has reached its website limit." };
  }

  const { error } = await supabase
    .from("projects")
    .update({ team_id: targetTeamId })
    .eq("id", projectId)
    .eq("team_id", current.team.teamId);
  if (error) return { ok: false, error: "We could not move that website. Please try again." };

  await createAdminClient()
    .from("ownership_transfers")
    .update({ status: "cancelled", resolved_at: new Date().toISOString(), resolved_by: current.user.id })
    .eq("project_id", projectId)
    .eq("status", "pending");

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "website_transferred_out",
    summary: `${current.user.email ?? "Someone"} moved the website to another team`,
  });
  invalidate(projectId);
  return { ok: true };
}

export async function requestTransfer(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "site.transfer")) {
    return { ok: false, error: "Only owners and admins can transfer this website." };
  }
  const email = clean(formData.get("email"), 200).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (current.user.email && normalizeTransferEmail(current.user.email) === email) {
    return { ok: false, error: "Use Move to another of my teams above to move it yourself." };
  }

  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const { data: pending } = await supabase
    .from("ownership_transfers")
    .select("id, to_email")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return {
      ok: false,
      error: `A transfer to ${pending.to_email ?? "someone"} is already waiting. Cancel it first.`,
    };
  }

  const admin = createAdminClient();
  const { token, hash } = newTransferToken();
  const expiresAt = new Date(Date.now() + TRANSFER_DAYS * 864e5).toISOString();
  const message = clean(formData.get("message"), 500) || null;
  const { data: transfer, error } = await admin
    .from("ownership_transfers")
    .insert({
      project_id: projectId,
      from_team_id: current.team.teamId,
      from_user_id: current.user.id,
      to_email: email,
      mode: "invite",
      status: "pending",
      token_hash: hash,
      message,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !transfer) {
    if (error?.code === "23505") {
      return { ok: false, error: "A transfer for this website is already waiting. Cancel it first." };
    }
    return { ok: false, error: "We could not start the transfer. Please try again." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", current.user.id)
    .maybeSingle();
  const fromName = profile?.full_name || current.team.teamName;
  const emailState = await sendTransferEmail({
    to: email,
    transferId: transfer.id,
    projectName: project.name,
    fromTeamName: current.team.teamName,
    fromName,
    token,
    expiresAt,
  });

  await logTeamActivity({
    teamId: current.team.teamId,
    actor: { userId: current.user.id, name: current.user.email ?? "Someone", role: current.team.role },
    event: "website_transfer_requested",
    summary: `${current.user.email ?? "Someone"} asked to send ${project.name} to ${email}`,
    project: { id: project.id, name: project.name },
    target: { type: "transfer", id: transfer.id, name: email },
  });
  invalidate(projectId);

  if (emailState === "sent" || emailState === "queued") {
    return { ok: true, message: `We sent the transfer request to ${email}.` };
  }
  return {
    ok: true,
    message: `The transfer is ready, but we could not send the email. Share this link with them: ${transferLink(token)}`,
  };
}

export async function cancelTransfer(
  projectId: string,
  transferId: string,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "site.transfer")) {
    return { ok: false, error: "Only owners and admins can cancel this transfer." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const admin = createAdminClient();
  const { data: transfer } = await admin
    .from("ownership_transfers")
    .select("id, to_email, status")
    .eq("id", transferId)
    .eq("project_id", projectId)
    .eq("from_team_id", current.team.teamId)
    .maybeSingle();
  if (!transfer || transfer.status !== "pending") {
    return { ok: false, error: "That transfer is no longer waiting." };
  }

  const { error } = await admin
    .from("ownership_transfers")
    .update({ status: "cancelled", resolved_at: new Date().toISOString(), resolved_by: current.user.id })
    .eq("id", transferId)
    .eq("status", "pending");
  if (error) return { ok: false, error: "We could not cancel that transfer. Please try again." };

  await logTeamActivity({
    teamId: current.team.teamId,
    actor: { userId: current.user.id, name: current.user.email ?? "Someone", role: current.team.role },
    event: "website_transfer_cancelled",
    summary: `${current.user.email ?? "Someone"} cancelled the transfer of ${project.name} to ${transfer.to_email ?? "someone"}`,
    project: { id: project.id, name: project.name },
    target: { type: "transfer", id: transferId, name: transfer.to_email },
  });
  invalidate(projectId);
  return { ok: true, message: "Transfer cancelled." };
}

export async function deleteProject(
  projectId: string,
  formData: FormData,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "site.delete")) {
    return { ok: false, error: "Only owners and admins can delete this website." };
  }
  const supabase = await createClient();
  const project = await findProject(supabase, projectId, current.team.teamId);
  if (!project) return { ok: false, error: "We could not find that website." };

  const quota = await getQuota(current.team.teamId);
  if (quota && quota.deleted_pending >= quota.max_deleted_pending) {
    return {
      ok: false,
      error: `You already have ${quota.max_deleted_pending} deleted websites waiting to be removed for good. Delete one forever first.`,
    };
  }

  const confirm = clean(formData.get("confirm"), 200);
  const expected = [`${project.subdomain}.get-on.tech`, project.subdomain];
  if (!expected.includes(confirm.toLowerCase())) {
    return { ok: false, error: "Type the web address exactly as it appears above." };
  }

  const now = new Date();
  const purgeAfter = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const holdUntil = new Date(now.getTime() + 44 * 24 * 60 * 60 * 1000);
  const { error } = await supabase
    .from("projects")
    .update({
      status: "draft",
      deleted_at: now.toISOString(),
      purge_after: purgeAfter.toISOString(),
      subdomain_hold_until: holdUntil.toISOString(),
      deleted_by: current.user.id,
    })
    .eq("id", projectId)
    .eq("team_id", current.team.teamId);
  if (error) return { ok: false, error: "We could not delete that. Please try again." };

  await createAdminClient()
    .from("ownership_transfers")
    .update({ status: "cancelled", resolved_at: now.toISOString(), resolved_by: current.user.id })
    .eq("project_id", projectId)
    .eq("status", "pending");

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "website_deleted",
    summary: `${current.user.email ?? "Someone"} deleted the website ${project.name}`,
    meta: { deleted_at: now.toISOString(), purge_after: purgeAfter.toISOString() },
  });
  invalidate(projectId);
  return { ok: true };
}

export async function restoreProject(
  projectId: string,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "site.restore")) {
    return { ok: false, error: "Only owners and admins can restore a website." };
  }
  const supabase = await createClient();
  const { data: check } = await supabase.rpc("check_restore_website", { p_project: projectId });
  const result = (check ?? {}) as { ok?: boolean; blockers?: Array<{ code?: string }> };
  if (result.ok !== true) {
    const first = result.blockers?.[0]?.code;
    if (first === "RESTORE_QUOTA") {
      return { ok: false, error: "Your plan has no room for this website. Delete one or upgrade first." };
    }
    if (first === "RESTORE_PAGES") {
      return { ok: false, error: "This website has more pages than your plan allows. Upgrade first." };
    }
    if (first === "RESTORE_EXPIRED") {
      return { ok: false, error: "This website can no longer be restored." };
    }
    return { ok: false, error: "This website cannot be restored right now." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (!project) return { ok: false, error: "We could not find that website." };

  const { error } = await supabase
    .from("projects")
    .update({
      deleted_at: null,
      purge_after: null,
      deleted_by: null,
      restored_at: new Date().toISOString(),
      status: "draft",
    })
    .eq("id", projectId)
    .eq("team_id", current.team.teamId);
  if (error) return { ok: false, error: "We could not restore that website. Please try again." };

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "website_restored",
    summary: `${current.user.email ?? "Someone"} restored the website ${project.name}`,
  });
  invalidate(projectId);
  return { ok: true };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function purgeProject(
  projectId: string,
): Promise<ProjectSettingsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, error: "Please sign in again." };
  if (!can(current.team.role, "site.purge")) {
    return { ok: false, error: "Only the owner can remove a website for good." };
  }
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, name, subdomain, team_id, deleted_at, subdomain_hold_until")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (!project) return { ok: false, error: "We could not find that website." };

  const { data: media } = await admin.from("media").select("path").eq("project_id", projectId);
  const paths = (media ?? []).map((item) => item.path).filter(Boolean);
  if (paths.length > 0) {
    await admin.storage.from("project-media").remove(paths);
  }

  await logActivity({
    projectId,
    actorUserId: current.user.id,
    event: "website_purged",
    summary: `${current.user.email ?? "Someone"} removed ${project.name} for good`,
    meta: { subdomain: project.subdomain },
  });

  const holdUntil = project.subdomain_hold_until
    ? new Date(project.subdomain_hold_until)
    : new Date(Date.now() + 30 * 864e5);
  if (holdUntil.getTime() > Date.now()) {
    await admin
      .from("subdomain_holds")
      .upsert({ name: project.subdomain, hold_until: holdUntil.toISOString() }, { onConflict: "name" });
  }

  const { error } = await admin.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: "We could not remove that website. Please try again." };
  invalidate(projectId);
  return { ok: true };
}
