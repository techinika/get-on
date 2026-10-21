import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";

type Params = { params: Promise<{ projectId: string }> };

/**
 * Guards the project routes. A project that belongs to another team is
 * treated as missing so we never leak information.
 */
export default async function ProjectLayout({
  children,
  params,
}: Params & { children: ReactNode }) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  if (!current) {
    notFound();
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  return <>{children}</>;
}
