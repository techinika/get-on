import { notFound, redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { loadAiSettings, loadTeamBalance } from "@/lib/ai/settings";
import { snapshotOf, templateOriginOf } from "@/lib/templates/apply";
import { templatesForPlan } from "@/lib/templates/catalog";

type Params = { params: Promise<{ projectId: string }> };

type ProjectRow = { id: string; name: string; settings: unknown };

export default async function ProjectTemplatesPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  if (!current) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, settings")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();

  const project = data as ProjectRow | null;
  if (!project) notFound();

  const templates = templatesForPlan(current.team.planId);
  const plan = planLimits(current.team.planId);
  const { count: pageCount } = await supabase
    .from("pages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id);
  const origin = templateOriginOf(project.settings);
  const snapshot = snapshotOf(project.settings);
  const admin = createAdminClient();
  const [aiSettings, aiBalance] = await Promise.all([
    loadAiSettings(admin),
    loadTeamBalance(admin, current.team.teamId),
  ]);

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: current.team.teamName, href: "/dashboard" },
          { label: project.name, href: `/dashboard/projects/${project.id}` },
          { label: "Templates" },
        ]}
        title="Templates"
        description="Choose a fresh design for this website. Your pages are saved first, so you can always undo the change."
      />
      <TemplateGallery
        items={templates}
        mode="project"
        projectId={project.id}
        projectName={project.name}
        currentSlug={origin?.slug}
        canRestore={Boolean(snapshot)}
        aiEnabled={aiSettings.enabled}
        aiCredits={aiBalance.total}
        maxPages={plan.maxPagesPerSite}
        currentPageCount={pageCount ?? 0}
      />
    </AppPage>
  );
}
