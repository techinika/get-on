import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectChrome } from "@/components/project/project-chrome";

export const instant = false;

type Params = { params: Promise<{ projectId: string }> };

type ProjectRow = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
};

export default async function ProjectLayout({
  children,
  params,
}: Params & { children: ReactNode }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("projects")
    .select("id, name, subdomain, status")
    .eq("id", projectId)
    .maybeSingle();

  const project = data as ProjectRow | null;
  if (!project) {
    notFound();
  }

  return (
    <ProjectChrome
      project={{
        id: project.id,
        name: project.name,
        subdomain: project.subdomain,
        status: project.status === "published" ? "published" : "draft",
      }}
    >
      {children}
    </ProjectChrome>
  );
}
