import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AdminOwner = { teamId: string; name: string; email: string };

export type AdminPublish = {
  id: string;
  status: string;
  created_at: string;
  live_at: string | null;
  error_code: string | null;
  pages_count: number | null;
};

export type AdminSiteRow = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  reviewState: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  reviewRequestedAt: string | null;
  teamId: string;
  teamName: string;
  ownerEmail: string;
  lastPublishedAt: string | null;
  reportCount: number;
  newReportCount: number;
};

export type AdminSite = AdminSiteRow & {
  publishes: AdminPublish[];
};

export type AdminReport = {
  id: string;
  reason: string;
  details: string | null;
  reporter_email: string | null;
  status: string;
  created_at: string;
};

export type AdminFlag = {
  id: string;
  kind: string;
  reason: string | null;
  notes: string | null;
  admin_email: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AdminAuditRow = {
  id: number;
  admin_email: string;
  action: string;
  reason: string | null;
  created_at: string;
};

function newest(values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!best || new Date(value).getTime() > new Date(best).getTime()) best = value;
  }
  return best;
}

/** Every website with its owner, newest report counts and last publish. */
export async function loadAdminSites(admin: AdminClient): Promise<AdminSiteRow[]> {
  const [{ data: projects }, { data: reports }, { data: publishes }] = await Promise.all([
    admin
      .from("projects")
      .select(
        "id, name, subdomain, status, review_state, suspended_at, suspended_reason, review_requested_at, team_id",
      )
      .order("created_at", { ascending: false }),
    admin.from("abuse_reports").select("project_id, status, created_at"),
    admin
      .from("publishes")
      .select("project_id, status, live_at, created_at")
      .in("status", ["live", "offline", "superseded", "ready"]),
  ]);

  const teamIds = [...new Set((projects ?? []).map((project) => project.team_id))];
  const { data: teams } = teamIds.length
    ? await admin.from("teams").select("id, name, owner_id").in("id", teamIds)
    : { data: [] as Array<{ id: string; name: string; owner_id: string }> };

  const ownerIds = [...new Set((teams ?? []).map((team) => team.owner_id))];
  const { data: profiles } = ownerIds.length
    ? await admin.from("profiles").select("id, email").in("id", ownerIds)
    : { data: [] as Array<{ id: string; email: string | null }> };

  return (projects ?? []).map((project) => {
    const team = (teams ?? []).find((row) => row.id === project.team_id);
    const owner = (profiles ?? []).find((row) => row.id === team?.owner_id);
    const siteReports = (reports ?? []).filter((row) => row.project_id === project.id);
    const sitePublishes = (publishes ?? []).filter((row) => row.project_id === project.id);
    return {
      id: project.id,
      name: project.name,
      subdomain: project.subdomain,
      status: project.status,
      reviewState: project.review_state,
      suspendedAt: project.suspended_at,
      suspendedReason: project.suspended_reason,
      reviewRequestedAt: project.review_requested_at,
      teamId: project.team_id,
      teamName: team?.name ?? "Team",
      ownerEmail: owner?.email ?? "No email",
      lastPublishedAt: newest(sitePublishes.map((row) => row.live_at ?? row.created_at)),
      reportCount: siteReports.length,
      newReportCount: siteReports.filter((row) => row.status === "new").length,
    };
  });
}

export async function loadAdminSite(
  admin: AdminClient,
  siteId: string,
): Promise<{
  site: AdminSite;
  reports: AdminReport[];
  flags: AdminFlag[];
  audit: AdminAuditRow[];
} | null> {
  const sites = await loadAdminSites(admin);
  const base = sites.find((site) => site.id === siteId);
  if (!base) return null;

  const [{ data: publishes }, { data: reports }, { data: flags }, { data: audit }] =
    await Promise.all([
      admin
        .from("publishes")
        .select("id, status, created_at, live_at, error_code, pages_count")
        .eq("project_id", siteId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("abuse_reports")
        .select("id, reason, details, reporter_email, status, created_at")
        .eq("project_id", siteId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("site_flags")
        .select("id, kind, reason, notes, admin_email, created_at, resolved_at")
        .eq("project_id", siteId)
        .order("created_at", { ascending: false }),
      admin
        .from("admin_audit_log")
        .select("id, admin_email, action, reason, created_at")
        .eq("project_id", siteId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  return {
    site: { ...base, publishes: (publishes ?? []) as AdminPublish[] },
    reports: (reports ?? []) as AdminReport[],
    flags: (flags ?? []) as AdminFlag[],
    audit: (audit ?? []) as AdminAuditRow[],
  };
}

export function adminSiteStatus(site: {
  status: string;
  reviewState: string;
  suspendedAt: string | null;
}): "Live" | "Not published" | "Under review" | "Suspended" {
  if (site.suspendedAt) return "Suspended";
  if (site.reviewState === "pending") return "Under review";
  return site.status === "published" ? "Live" : "Not published";
}

/** Reports created in the last 24 hours. */
export async function countReportsToday(admin: AdminClient): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("abuse_reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  return count ?? 0;
}
