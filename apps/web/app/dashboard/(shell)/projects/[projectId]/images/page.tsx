import { notFound, redirect } from "next/navigation";
import { aiConfig } from "@/lib/ai/config";
import { loadAiSettings } from "@/lib/ai/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { PicturesContent, type MediaItem } from "@/components/app/pictures-content";

type Params = { params: Promise<{ projectId: string }> };

export default async function ImagesPage({ params }: Params) {
  const { projectId } = await params;
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();

  const project = row as { id: string; name: string } | null;
  if (!project) {
    notFound();
  }

  const aiSettings = await loadAiSettings(createAdminClient());
  const imagesEnabled = aiSettings.imagesEnabled && aiConfig().imagesEnabled;

  const { data: media } = await supabase
    .from("media")
    .select("id, path, filename, mime, size_bytes, width, height, alt, created_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <PicturesContent
      projectId={project.id}
      teamName={data.currentTeam.name}
      projectName={project.name}
      items={(media ?? []) as MediaItem[]}
      imagesEnabled={imagesEnabled}
    />
  );
}
