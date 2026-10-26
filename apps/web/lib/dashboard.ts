import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
import { initialsFrom } from "@/lib/viewer";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";
import type {
  ShellProject,
  ShellRole,
  ShellTeam,
  ShellUsage,
  ShellUser,
} from "@/components/shell/types";

export const TEAM_COOKIE = "gs_team";
export const SIDEBAR_COOKIE = "gs_sidebar";

type MembershipRow = { team_id: string; role: ShellRole };
type TeamRow = {
  id: string;
  name: string;
  plan_id: string;
  is_personal: boolean;
};

export type ShellDeletedProject = {
  id: string;
  name: string;
  subdomain: string;
  deletedAt: string;
  purgeAfter: string | null;
};

export type ShellData = {
  user: ShellUser;
  teams: ShellTeam[];
  currentTeam: ShellTeam;
  projects: ShellProject[];
  deletedProjects: ShellDeletedProject[];
  usage: ShellUsage;
};

/**
 * Everything the app shell needs, fetched once per request (spec §7.5).
 * The current team comes from the `gs_team` cookie and is validated against
 * the user's memberships; it falls back to the personal team.
 */
export const getShellData = cache(async (): Promise<ShellData | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("team_id", { ascending: true }),
  ]);

  const rows = (memberships ?? []) as MembershipRow[];
  const teamIds = rows.map((row) => row.team_id);
  const { data: teamRows } = teamIds.length
    ? await supabase
        .from("teams")
        .select("id, name, plan_id, is_personal")
        .in("id", teamIds)
    : { data: [] as TeamRow[] };

  const accesses = await Promise.all(
    (teamRows ?? []).map(async (team) => {
      const { data } = await supabase.rpc("billing_resolve_team", { p_team: team.id });
      return { teamId: team.id, access: (data ?? {}) as { plan_id?: string; status?: string } };
    }),
  );
  const accessByTeam = new Map(accesses.map((row) => [row.teamId, row.access]));

  const teams: ShellTeam[] = (teamRows ?? []).map((team) => {
    const membership = rows.find((row) => row.team_id === team.id);
    const access = accessByTeam.get(team.id);
    const planId = (access?.plan_id as PlanId | undefined) ?? ((team.plan_id as PlanId) ?? "free");
    return {
      id: team.id,
      name: team.name,
      planId,
      role: (membership?.role ?? "viewer") as ShellRole,
      isPersonal: Boolean(team.is_personal),
      billingStatus: (access?.status as ShellTeam["billingStatus"]) ?? "free",
    };
  });

  if (teams.length === 0) return null;

  const cookieStore = await cookies();
  const wantedTeam = cookieStore.get(TEAM_COOKIE)?.value;
  const currentTeam =
    teams.find((team) => team.id === wantedTeam) ??
    teams.find((team) => team.isPersonal) ??
    teams[0]!;

  const { data: balance, error: balanceError } = await supabase.rpc(
    "ai_balance",
    { p_team: currentTeam.id },
  );
  const aiCredits = balanceError
    ? (PLAN_BY_ID[currentTeam.planId]?.aiMonthlyCredits ?? 0)
    : Number(
        balance && typeof balance === "object"
          ? (balance as { total?: unknown }).total ?? 0
          : 0,
      );

  const [{ data: projects }, { count: memberCount }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, subdomain, primary_host, status, content_revision, created_at, updated_at, deleted_at, purge_after")
      .eq("team_id", currentTeam.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("user_id", { count: "exact", head: true })
      .eq("team_id", currentTeam.id)
      .eq("status", "active"),
  ]);

  const visibleProjects = (projects ?? []).filter(
    (project: { deleted_at?: string | null }) => !project.deleted_at,
  );
  const deletedProjects: ShellDeletedProject[] = (projects ?? [])
    .filter((project: { deleted_at?: string | null }) => Boolean(project.deleted_at))
    .map((project: { id: string; name: string; subdomain: string; deleted_at: string; purge_after?: string | null }) => ({
      id: project.id,
      name: project.name,
      subdomain: project.subdomain,
      deletedAt: project.deleted_at,
      purgeAfter: project.purge_after ?? null,
    }));

  const projectIds = visibleProjects.map((project) => project.id);
  let contactProjects = new Set<string>();
  let unreadByProject = new Map<string, number>();
  let storageBytes = 0;
  let liveRevisions = new Map<string, number>();
  const homepageByProject = new Map<string, string>();

  if (projectIds.length > 0) {
    const [{ data: installs }, { data: unread }, { data: mediaRows }, { data: liveRows }, { data: pageRows }] =
      await Promise.all([
        supabase
          .from("plugin_installs")
          .select("project_id")
          .eq("plugin_id", "contact")
          .eq("state", "active")
          .in("project_id", projectIds),
        supabase
          .from("contact_messages")
          .select("project_id")
          .eq("status", "new")
          .in("project_id", projectIds),
        supabase
          .from("media")
          .select("size_bytes")
          .in("project_id", projectIds)
          .is("deleted_at", null),
        supabase
          .from("publishes")
          .select("project_id, content_revision")
          .eq("status", "live")
          .in("project_id", projectIds),
        supabase
          .from("pages")
          .select("id, project_id, is_homepage, position")
          .in("project_id", projectIds)
          .order("position", { ascending: true }),
      ]);
    contactProjects = new Set((installs ?? []).map((row) => String(row.project_id)));
    unreadByProject = new Map();
    for (const row of unread ?? []) {
      const key = String(row.project_id);
      unreadByProject.set(key, (unreadByProject.get(key) ?? 0) + 1);
    }
    for (const row of mediaRows ?? []) {
      storageBytes += typeof row.size_bytes === "number" ? row.size_bytes : 0;
    }
    liveRevisions = new Map(
      (liveRows ?? []).map((row) => [
        String(row.project_id),
        Number(row.content_revision ?? 0),
      ]),
    );
    for (const row of pageRows ?? []) {
      const key = String(row.project_id);
      if (!homepageByProject.has(key) || row.is_homepage) {
        homepageByProject.set(key, String(row.id));
      }
    }
  }

  const publishConfig = readPublishConfig();

  const shellProjects: ShellProject[] = (visibleProjects).map((project) => {
    const status = project.status === "published" ? "published" : "draft";
    const liveRevision = liveRevisions.get(project.id);
    const hasUnpublishedChanges =
      status === "published" &&
      liveRevision !== undefined &&
      Number(project.content_revision ?? 0) !== liveRevision;
    return {
      id: project.id,
      name: project.name,
      subdomain: project.subdomain,
      status,
      updatedAt: project.updated_at ?? project.created_at ?? null,
      contactEnabled: contactProjects.has(project.id),
      unreadMessages: unreadByProject.get(project.id) ?? 0,
      homepageId: homepageByProject.get(project.id) ?? null,
      hasUnpublishedChanges,
      primaryHost:
        typeof project.primary_host === "string" ? project.primary_host : null,
      siteUrl: primaryAddress(
        publishConfig,
        project.subdomain,
        project.primary_host,
      ),
    };
  });

  return {
    user: {
      id: user.id,
      name: profile?.full_name ?? user.email ?? "Account",
      email: user.email ?? "",
      initials: initialsFrom(profile?.full_name, user.email),
    },
    teams,
    currentTeam,
    projects: shellProjects,
    deletedProjects,
    usage: {
      websites: shellProjects.length,
      members: memberCount ?? 0,
      storageBytes,
      aiCredits: Number.isFinite(aiCredits) ? aiCredits : 0,
    },
  };
});

/** Reads the server-rendered sidebar state. */
export async function getSidebarState(): Promise<"expanded" | "collapsed"> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SIDEBAR_COOKIE)?.value;
  return value === "collapsed" ? "collapsed" : "expanded";
}

export { PLAN_BY_ID };
