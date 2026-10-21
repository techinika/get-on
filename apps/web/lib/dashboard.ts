import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
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

export type ShellData = {
  user: ShellUser;
  teams: ShellTeam[];
  currentTeam: ShellTeam;
  projects: ShellProject[];
  usage: ShellUsage;
};

function initialsFrom(name: string | null | undefined, email: string | undefined): string {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "U";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

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

  const teams: ShellTeam[] = (teamRows ?? []).map((team) => {
    const membership = rows.find((row) => row.team_id === team.id);
    return {
      id: team.id,
      name: team.name,
      planId: (team.plan_id as PlanId) ?? "free",
      role: (membership?.role ?? "viewer") as ShellRole,
      isPersonal: Boolean(team.is_personal),
    };
  });

  if (teams.length === 0) return null;

  const cookieStore = await cookies();
  const wantedTeam = cookieStore.get(TEAM_COOKIE)?.value;
  const currentTeam =
    teams.find((team) => team.id === wantedTeam) ??
    teams.find((team) => team.isPersonal) ??
    teams[0]!;

  const [{ data: projects }, { count: memberCount }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, subdomain, status, created_at, updated_at")
      .eq("team_id", currentTeam.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("user_id", { count: "exact", head: true })
      .eq("team_id", currentTeam.id),
  ]);

  const shellProjects: ShellProject[] = (projects ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    subdomain: project.subdomain,
    status: project.status === "published" ? "published" : "draft",
    updatedAt: project.updated_at ?? project.created_at ?? null,
  }));

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
    usage: {
      websites: shellProjects.length,
      members: memberCount ?? 0,
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
