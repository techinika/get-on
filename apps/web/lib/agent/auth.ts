import { getCurrentTeam } from "@/lib/team";
import type { ShellRole } from "@/components/shell/types";
import type { PlanId } from "@/lib/plans";

export type AgentActor = {
  userId: string;
  teamId: string;
  teamName: string;
  role: ShellRole;
  planId: PlanId;
};

export async function getAgentActor(): Promise<AgentActor | null> {
  const current = await getCurrentTeam();
  if (!current) return null;
  return {
    userId: current.user.id,
    teamId: current.team.teamId,
    teamName: current.team.teamName,
    role: current.team.role,
    planId: current.team.planId,
  };
}

/** Viewers can read the help content but cannot start paid AI actions. */
export function canUseAssistant(role: ShellRole): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}
