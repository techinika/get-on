import { createAdminClient } from "@/lib/supabase/admin";
import { readPublishConfig, siteHostname } from "@/lib/publishing/config";
import { createPublishStore } from "@/lib/publishing/store";
import {
  PublishError,
  publishProject,
  rebuildPublishedSite,
  type PublishContext,
} from "@/lib/publishing/service";

export type SiteResult = { ok: true } | { ok: false; code: string };

/**
 * Privileged publishing operations used by the staff website record. The
 * service role is required to build and move a site, but this module returns
 * only status codes. Customer content never leaves this module.
 */

async function projectRow(projectId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select(
      "id, name, subdomain, team_id, suspended_at, review_state, plan_paused_at",
    )
    .eq("id", projectId)
    .maybeSingle();
  return { admin, project: data };
}

async function teamPlanId(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
): Promise<string> {
  const { data } = await admin.rpc("billing_resolve_team", { p_team: teamId });
  return String((data as { plan_id?: string } | null)?.plan_id ?? "free");
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

export async function takeSiteOffline(
  siteId: string,
  reason: string,
): Promise<SiteResult> {
  const { admin, project } = await projectRow(siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };

  const publish = await latestSuccessfulPublish(admin, project.id);
  if (!publish) return { ok: false, code: "NO_LIVE_VERSION" };

  const config = readPublishConfig();
  const store = createPublishStore(config);
  const hostname = siteHostname(config, String(project.subdomain));
  const existing = await store.getPointer(hostname);
  await store.writePointer(hostname, {
    ...(existing ?? {}),
    siteId: project.id,
    publishId: String(publish.id),
    state: "suspended",
    builtAt: String(publish.live_at ?? publish.finished_at ?? publish.created_at),
    plan: await teamPlanId(admin, project.team_id),
  });

  await admin
    .from("projects")
    .update({
      status: "draft",
      suspended_at: new Date().toISOString(),
      suspended_reason: reason,
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
    reason,
  });

  return { ok: true };
}

export async function pauseSiteForPlan(
  siteId: string,
  reason: string,
): Promise<SiteResult> {
  const { admin, project } = await projectRow(siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };
  if (project.plan_paused_at) return { ok: true };
  if (project.suspended_at) return { ok: false, code: "SUSPENDED" };

  const publish = await latestSuccessfulPublish(admin, project.id);
  if (!publish) return { ok: false, code: "NO_LIVE_VERSION" };

  const config = readPublishConfig();
  const store = createPublishStore(config);
  const hostname = siteHostname(config, String(project.subdomain));
  const existing = await store.getPointer(hostname);
  if (!existing) return { ok: false, code: "NO_LIVE_VERSION" };

  await store.writePointer(hostname, { ...existing, planLapsed: true });

  const { data: domains } = await admin
    .from("domains")
    .select("id")
    .eq("project_id", project.id)
    .not("status", "in", "(removed,failed)");
  const domainIds = (domains ?? []).map((domain) => String(domain.id));
  if (domainIds.length > 0) {
    const { data: hosts } = await admin
      .from("domain_hostnames")
      .select("hostname")
      .in("domain_id", domainIds)
      .eq("status", "live");
    for (const host of hosts ?? []) {
      await store.writeHostPointer(String(host.hostname), project.id, {
        planLapsed: true,
      });
    }
  }

  const now = new Date().toISOString();
  await admin
    .from("projects")
    .update({
      plan_paused_at: now,
      plan_paused_reason: reason,
    })
    .eq("id", project.id);

  return { ok: true };
}

export async function bringSiteOnline(
  siteId: string,
  staffId: string,
): Promise<SiteResult> {
  const { admin, project } = await projectRow(siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };

  const publish = await latestSuccessfulPublish(admin, project.id);
  if (!publish) return { ok: false, code: "NO_LIVE_VERSION" };

  const config = readPublishConfig();
  const store = createPublishStore(config);
  const hostname = siteHostname(config, String(project.subdomain));
  const existing = await store.getPointer(hostname);
  await store.writePointer(hostname, {
    ...(existing ?? {}),
    siteId: project.id,
    publishId: String(publish.id),
    state: "live",
    builtAt: String(publish.live_at ?? publish.finished_at ?? publish.created_at),
    plan: await teamPlanId(admin, project.team_id),
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
    .update({ resolved_at: now, resolved_by: staffId })
    .eq("project_id", project.id)
    .eq("kind", "suspension")
    .is("resolved_at", null);

  return { ok: true };
}

export async function rebuildSite(
  siteId: string,
  staffId: string,
): Promise<SiteResult> {
  const { admin, project } = await projectRow(siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };

  const ctx: PublishContext = {
    supabase: admin as unknown as PublishContext["supabase"],
    user: { id: staffId },
    team: {
      teamId: project.team_id,
      planId: await teamPlanId(admin, project.team_id),
    },
    project: {
      id: project.id,
      name: String(project.name),
      subdomain: String(project.subdomain),
    },
    bypassRateLimit: true,
    force: true,
  };

  try {
    await rebuildPublishedSite(ctx);
  } catch (error) {
    const code = error instanceof PublishError ? error.code : "PUBLISH_FAILED";
    return { ok: false, code };
  }
  return { ok: true };
}

export async function approveAndPublish(
  siteId: string,
  staffId: string,
): Promise<SiteResult> {
  const { admin, project } = await projectRow(siteId);
  if (!project) return { ok: false, code: "NOT_FOUND" };

  const planId = await teamPlanId(admin, project.team_id);

  await admin
    .from("projects")
    .update({ review_state: "none", review_requested_at: null })
    .eq("id", project.id);
  await admin
    .from("site_flags")
    .update({ resolved_at: new Date().toISOString(), resolved_by: staffId })
    .eq("project_id", project.id)
    .eq("kind", "review")
    .is("resolved_at", null);

  const ctx: PublishContext = {
    supabase: admin as unknown as PublishContext["supabase"],
    user: { id: staffId },
    team: { teamId: project.team_id, planId },
    project: {
      id: project.id,
      name: String(project.name),
      subdomain: String(project.subdomain),
    },
    bypassRateLimit: true,
  };

  try {
    await publishProject(ctx);
  } catch {
    await admin
      .from("projects")
      .update({
        review_state: "pending",
        review_requested_at: new Date().toISOString(),
      })
      .eq("id", project.id);
    return { ok: false, code: "PUBLISH_FAILED" };
  }
  return { ok: true };
}
