import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { PagesList } from "@/components/project/pages-list";
import type { PageRow } from "@/components/project/types";

export const instant = false;

type Params = { params: Promise<{ projectId: string }> };

export default async function PagesPage({ params }: Params) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("projects")
    .select("id, name, subdomain")
    .eq("id", projectId)
    .maybeSingle();

  const project = data as { id: string; name: string; subdomain: string } | null;
  if (!project) {
    notFound();
  }

  const { data: rows } = await supabase
    .from("pages")
    .select("id, project_id, title, path, position, is_homepage, blocks, created_at")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  const current = await getCurrentTeam();
  const plan = planLimits(current?.team.planId ?? "free");

  return (
    <PagesList
      project={{ id: project.id, subdomain: project.subdomain }}
      planName={plan.name}
      pageLimit={plan.maxPagesPerSite}
      pages={(rows ?? []) as PageRow[]}
    />
  );
}
