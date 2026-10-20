import { createClient } from "@/lib/supabase/server";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";

export type CurrentTeam = {
  teamId: string;
  teamName: string;
  planId: PlanId;
  role: "owner" | "admin" | "editor" | "viewer";
};

/** Fetch the current user's first team with its plan. */
export async function getCurrentTeam(): Promise<
  { user: { id: string; email?: string }; team: CurrentTeam } | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, plan_id")
    .eq("id", membership.team_id)
    .maybeSingle();

  if (!team) return null;

  return {
    user: { id: user.id, email: user.email },
    team: {
      teamId: team.id,
      teamName: team.name,
      planId: (team.plan_id as PlanId) ?? "free",
      role: membership.role as CurrentTeam["role"],
    },
  };
}

export function planLimits(planId: PlanId) {
  return PLAN_BY_ID[planId] ?? PLAN_BY_ID.free;
}
