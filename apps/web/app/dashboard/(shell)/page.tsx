import { redirect } from "next/navigation";
import { getShellData } from "@/lib/dashboard";
import { planLimits } from "@/lib/team";
import { WebsitesContent } from "@/components/app/websites-content";
import { RecentlyDeleted } from "@/components/app/recently-deleted";
import { can } from "@/lib/permissions";

export default async function DashboardPage() {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const plan = planLimits(data.currentTeam.planId);

  return (
    <>
    <WebsitesContent
      teamName={data.currentTeam.name}
      planName={plan.name}
      websiteCount={data.usage.websites}
      maxWebsites={plan.maxWebsites}
      memberCount={data.usage.members}
      maxMembers={plan.maxMembers}
      aiCredits={data.usage.aiCredits ?? 0}
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
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
      <RecentlyDeleted
        websites={data.deletedProjects}
        canRestore={can(data.currentTeam.role as "owner" | "admin" | "editor" | "viewer", "site.restore")}
        canPurge={can(data.currentTeam.role as "owner" | "admin" | "editor" | "viewer", "site.purge")}
      />
    </div>
    </>
  );
}
