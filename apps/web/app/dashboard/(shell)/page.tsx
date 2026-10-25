import { redirect } from "next/navigation";
import { getShellData } from "@/lib/dashboard";
import { planLimits } from "@/lib/team";
import { WebsitesContent } from "@/components/app/websites-content";

export default async function DashboardPage() {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const plan = planLimits(data.currentTeam.planId);

  return (
    <WebsitesContent
      teamName={data.currentTeam.name}
      planName={plan.name}
      websiteCount={data.usage.websites}
      maxWebsites={plan.maxWebsites}
      memberCount={data.usage.members}
      maxMembers={plan.maxMembers}
      aiCredits={plan.aiMonthlyCredits}
      websites={data.projects.map((project) => ({
        id: project.id,
        name: project.name,
        subdomain: project.subdomain,
        status: project.status,
        updatedAt: project.updatedAt ?? null,
        unreadMessages: project.unreadMessages ?? 0,
        siteUrl: project.siteUrl ?? null,
        primaryHost: project.primaryHost ?? null,
      }))}
    />
  );
}
