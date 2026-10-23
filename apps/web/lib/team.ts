import { getShellData } from "@/lib/dashboard";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
import type { ShellRole } from "@/components/shell/types";

export type CurrentTeam = {
  teamId: string;
  teamName: string;
  planId: PlanId;
  role: ShellRole;
};

/**
 * The team the user is working in. The `gs_team` cookie decides which one,
 * after being validated against the user's memberships.
 */
export async function getCurrentTeam(): Promise<
  { user: { id: string; email?: string }; team: CurrentTeam } | null
> {
  const data = await getShellData();
  if (!data) return null;

  return {
    user: { id: data.user.id, email: data.user.email },
    team: {
      teamId: data.currentTeam.id,
      teamName: data.currentTeam.name,
      planId: data.currentTeam.planId,
      role: data.currentTeam.role,
    },
  };
}

export function planLimits(planId: PlanId) {
  return PLAN_BY_ID[planId] ?? PLAN_BY_ID.free;
}
