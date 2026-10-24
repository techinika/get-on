import { notFound, redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
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
  const origin = templateOriginOf(project.settings);
  const snapshot = snapshotOf(project.settings);

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
        currentSlug={origin?.slug}
        canRestore={Boolean(snapshot)}
      />
    </AppPage>
  );
}
