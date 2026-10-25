import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits, type CurrentTeam } from "@/lib/team";

export const PAGE_COLUMNS =
  "id, project_id, title, path, position, is_homepage, blocks, created_at, updated_at";

export type ProjectContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  current: { user: { id: string; email?: string }; team: CurrentTeam };
  project: { id: string; name: string; subdomain: string; primary_host: string | null };
};

/** Verify the current user can access this project. */
export async function requireProject(projectId: string): Promise<
  { ok: true; ctx: ProjectContext } | { ok: false; response: NextResponse }
> {
  const current = await getCurrentTeam();
  if (!current) {
    return {
      ok: false,
      response: NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 401 }),
    };
  }
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, subdomain, primary_host")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();

  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 }),
    };
  }
  return {
    ok: true,
    ctx: {
      supabase,
      current,
      project: {
        ...project,
        primary_host:
          typeof project.primary_host === "string" ? project.primary_host : null,
      },
    },
  };
}

/** True when the team's plan still allows another page on this project. */
export async function hasPageCapacity(ctx: ProjectContext): Promise<boolean> {
  const plan = planLimits(ctx.current.team.planId);
  if (plan.maxPagesPerSite === null) return true;
  const { count } = await ctx.supabase
    .from("pages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", ctx.project.id);
  return (count ?? 0) < plan.maxPagesPerSite;
}
