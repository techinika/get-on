import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { DashboardContent } from "@/components/project/dashboard-content";

export const instant = false;

export default async function DashboardPage() {
  const current = await getCurrentTeam();
  if (!current) {
    redirect("/login");
  }

  const supabase = await createClient();
  const plan = planLimits(current.team.planId);

  const [{ data: projects, count: websiteCount }, { count: memberCount }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, subdomain, status, created_at")
      .eq("team_id", current.team.teamId)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("user_id", { count: "exact", head: true })
      .eq("team_id", current.team.teamId),
  ]);

  return (
    <DashboardContent
      planName={plan.name}
      websiteCount={websiteCount ?? 0}
      maxWebsites={plan.maxWebsites}
      memberCount={memberCount ?? 0}
      maxMembers={plan.maxMembers}
      aiCredits={plan.aiCreditsMonthly}
      projects={(projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        subdomain: p.subdomain,
        status: p.status as "draft" | "published",
      }))}
    />
  );
}
