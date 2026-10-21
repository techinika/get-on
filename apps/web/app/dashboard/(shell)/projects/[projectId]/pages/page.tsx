import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { planLimits } from "@/lib/team";
import { PagesList } from "@/components/project/pages-list";
import type { PageRow } from "@/components/project/types";

type Params = { params: Promise<{ projectId: string }> };

export default async function PagesPage({ params }: Params) {
  const { projectId } = await params;
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("projects")
    .select("id, name, subdomain")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();

  const project = row as { id: string; name: string; subdomain: string } | null;
  if (!project) {
    notFound();
  }

  const { data: rows } = await supabase
    .from("pages")
    .select("id, project_id, title, path, position, is_homepage, blocks, created_at, updated_at")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  const plan = planLimits(data.currentTeam.planId);

  return (
    <PagesList
      project={{ id: project.id, subdomain: project.subdomain, name: project.name }}
      teamName={data.currentTeam.name}
      planName={plan.name}
      pageLimit={plan.maxPagesPerSite}
      pages={(rows ?? []) as PageRow[]}
    />
  );
}
