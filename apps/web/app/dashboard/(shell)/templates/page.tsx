import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { templatesForPlan } from "@/lib/templates/catalog";

export default async function TemplatesPage() {
  const current = await getCurrentTeam();
  if (!current) redirect("/login");

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("team_id", current.team.teamId)
    .order("created_at", { ascending: true });

  const templates = templatesForPlan(current.team.planId);

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[{ label: "Templates" }]}
        title="Templates"
        description="Ready-made designs for your website. Pick one, then make it yours. You can change everything later."
      />
      <TemplateGallery
        items={templates}
        mode="dashboard"
        projects={projects ?? []}
      />
    </AppPage>
  );
}
