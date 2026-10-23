import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { MessagesContent, type MessageItem } from "@/components/project/messages-content";

type Props = { params: Promise<{ projectId: string }> };

function nowMs(): number {
  return Date.now();
}

export default async function MessagesPage({ params }: Props) {
  const { projectId } = await params;
  const data = await getShellData();
  if (!data) redirect("/login");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, team_id, form_limit_hit_at")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: install }, { data: messages }, { data: pages }, { count: publishes }] =
    await Promise.all([
      supabase
        .from("plugin_installs")
        .select("state")
        .eq("project_id", projectId)
        .eq("plugin_id", "contact")
        .maybeSingle(),
      supabase
        .from("contact_messages")
        .select("id, name, email, phone, message, status, replied, page_path, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("pages").select("path, title").eq("project_id", projectId),
      supabase
        .from("publishes")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId),
    ]);

  const pageTitles: Record<string, string> = {};
  for (const page of pages ?? []) pageTitles[String(page.path)] = String(page.title);

  const limitAt = project.form_limit_hit_at ? new Date(String(project.form_limit_hit_at)).getTime() : 0;
  const limitHit = Boolean(limitAt && nowMs() - limitAt < 24 * 60 * 60 * 1000);

  return (
    <MessagesContent
      projectId={project.id}
      projectName={project.name}
      teamName={data.currentTeam.name}
      initialMessages={(messages ?? []) as MessageItem[]}
      pages={pageTitles}
      active={install?.state === "active"}
      everPublished={(publishes ?? 0) > 0}
      limitHit={limitHit}
    />
  );
}
