"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/admin";
import { getShellData } from "@/lib/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPublishConfig, siteHostname } from "@/lib/publishing/config";
import { createPublishStore } from "@/lib/publishing/store";
import { publishProject, type PublishContext } from "@/lib/publishing/service";

export type AdminActionResult = { ok: true } | { ok: false; code: string };

type AdminUser = { id: string; email: string };

async function requireAdmin(): Promise<AdminUser> {
  const data = await getShellData();
  if (!data || !isAdminEmail(data.user.email)) throw new Error("NOT_FOUND");
  return { id: data.user.id, email: data.user.email };
}

async function audit(
  admin: ReturnType<typeof createAdminClient>,
  adminEmail: string,
  action: string,
  projectId: string,
  reason: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await admin.from("admin_audit_log").insert({
    admin_email: adminEmail,
    action,
    project_id: projectId,
    reason,
    metadata,
  });
  if (error) console.error("[admin] could not write audit log", error);
}

async function projectRow(admin: ReturnType<typeof createAdminClient>, projectId: string) {
  const { data } = await admin
    .from("projects")
    .select("id, name, subdomain, team_id, suspended_at, review_state")
    .eq("id", projectId)
    .maybeSingle();
  return data;
}

async function teamPlanId(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
): Promise<string> {
  const { data } = await admin
    .from("teams")
    .select("plan_id")
    .eq("id", teamId)
    .maybeSingle();
  return String(data?.plan_id ?? "free");
}

async function latestSuccessfulPublish(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
) {
  const { data } = await admin
    .from("publishes")
    .select("id, status, live_at, finished_at, created_at")
    .eq("project_id", projectId)
    .in("status", ["live", "offline", "superseded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function refresh(siteId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/sites");
  revalidatePath(`/admin/sites/${siteId}`);
}

export async function takeSiteOffline(
  siteId: string,
  reason: string,
): Promise<AdminActionResult> {
  const adminUser = await requireAdmin();
  const cleaned = reason.trim();
  if (cleaned.length < 3) return { ok: false, code: "REASON_REQUIRED" };

  const admin = createAdminClient();
  const project = await projectRow(admin, siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };

  const publish = await latestSuccessfulPublish(admin, project.id);
  if (!publish) return { ok: false, code: "NO_LIVE_VERSION" };

  const config = readPublishConfig();
  const store = createPublishStore(config);
  const hostname = siteHostname(config, String(project.subdomain));
  const existing = await store.getPointer(hostname);
  await store.writePointer(hostname, {
    siteId: project.id,
    publishId: String(publish.id),
    state: "suspended",
    builtAt: String(publish.live_at ?? publish.finished_at ?? publish.created_at),
    plan: await teamPlanId(admin, project.team_id),
    ...(existing?.pause ? { pause: existing.pause } : {}),
    ...(existing?.redirects?.length ? { redirects: existing.redirects } : {}),
  });

  await admin
    .from("projects")
    .update({
      status: "draft",
      suspended_at: new Date().toISOString(),
      suspended_reason: cleaned,
    })
    .eq("id", project.id);
  await admin
    .from("publishes")
    .update({ status: "offline" })
    .eq("id", publish.id)
    .eq("status", "live");
  await admin.from("site_flags").insert({
    project_id: project.id,
    kind: "suspension",
    reason: cleaned,
    admin_email: adminUser.email,
  });

  await audit(admin, adminUser.email, "take_offline", project.id, cleaned, {
    publishId: publish.id,
  });
  refresh(siteId);
  return { ok: true };
}

export async function bringSiteOnline(siteId: string): Promise<AdminActionResult> {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();
  const project = await projectRow(admin, siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };

  const publish = await latestSuccessfulPublish(admin, project.id);
  if (!publish) return { ok: false, code: "NO_LIVE_VERSION" };

  const config = readPublishConfig();
  const store = createPublishStore(config);
  const hostname = siteHostname(config, String(project.subdomain));
  const existing = await store.getPointer(hostname);
  await store.writePointer(hostname, {
    siteId: project.id,
    publishId: String(publish.id),
    state: "live",
    builtAt: String(publish.live_at ?? publish.finished_at ?? publish.created_at),
    plan: await teamPlanId(admin, project.team_id),
    ...(existing?.pause ? { pause: existing.pause } : {}),
    ...(existing?.redirects?.length ? { redirects: existing.redirects } : {}),
  });

  const now = new Date().toISOString();
  await admin
    .from("publishes")
    .update({ status: "superseded" })
    .eq("project_id", project.id)
    .eq("status", "live");
  await admin
    .from("publishes")
    .update({ status: "live", live_at: now })
    .eq("id", publish.id);
  await admin
    .from("projects")
    .update({ status: "published", suspended_at: null, suspended_reason: null })
    .eq("id", project.id);
  await admin
    .from("site_flags")
    .update({ resolved_at: now, resolved_by: adminUser.id })
    .eq("project_id", project.id)
    .eq("kind", "suspension")
    .is("resolved_at", null);

  await audit(admin, adminUser.email, "bring_online", project.id, null, {
    publishId: publish.id,
  });
  refresh(siteId);
  return { ok: true };
}

export async function requestSiteReview(siteId: string): Promise<AdminActionResult> {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();
  const project = await projectRow(admin, siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };

  const now = new Date().toISOString();
  await admin
    .from("projects")
    .update({ review_state: "pending", review_requested_at: now })
    .eq("id", project.id);
  await admin.from("site_flags").insert({
    project_id: project.id,
    kind: "review",
    reason: "Review requested by an admin",
    admin_email: adminUser.email,
  });

  await audit(admin, adminUser.email, "request_review", project.id, null);
  refresh(siteId);
  return { ok: true };
}

export async function approveSite(siteId: string): Promise<AdminActionResult> {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();
  const project = await projectRow(admin, siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };

  const { data: team } = await admin
    .from("teams")
    .select("id, plan_id")
    .eq("id", project.team_id)
    .maybeSingle();

  await admin
    .from("projects")
    .update({ review_state: "none", review_requested_at: null })
    .eq("id", project.id);
  await admin
    .from("site_flags")
    .update({ resolved_at: new Date().toISOString(), resolved_by: adminUser.id })
    .eq("project_id", project.id)
    .eq("kind", "review")
    .is("resolved_at", null);

  const ctx: PublishContext = {
    supabase: admin as unknown as PublishContext["supabase"],
    user: { id: adminUser.id },
    team: {
      teamId: project.team_id,
      planId: String(team?.plan_id ?? "free"),
    },
    project: {
      id: project.id,
      name: String(project.name),
      subdomain: String(project.subdomain),
    },
    bypassRateLimit: true,
  };

  try {
    await publishProject(ctx);
  } catch (error) {
    await admin
      .from("projects")
      .update({ review_state: "pending", review_requested_at: new Date().toISOString() })
      .eq("id", project.id);
    await audit(admin, adminUser.email, "approve_publish_failed", project.id, null, {
      error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    refresh(siteId);
    return { ok: false, code: "PUBLISH_FAILED" };
  }

  await audit(admin, adminUser.email, "approve_publish", project.id, null);
  refresh(siteId);
  return { ok: true };
}

export async function removeReport(
  siteId: string,
  reportId: string,
): Promise<AdminActionResult> {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();

  const { data: report } = await admin
    .from("abuse_reports")
    .select("id, project_id, reason")
    .eq("id", reportId)
    .eq("project_id", siteId)
    .maybeSingle();
  if (!report) return { ok: false, code: "NOT_FOUND" };

  await admin
    .from("abuse_reports")
    .update({
      status: "handled",
      handled_at: new Date().toISOString(),
      handled_by: adminUser.id,
    })
    .eq("id", report.id);

  await audit(admin, adminUser.email, "remove_report", siteId, String(report.reason), {
    reportId: report.id,
  });
  refresh(siteId);
  return { ok: true };
}
