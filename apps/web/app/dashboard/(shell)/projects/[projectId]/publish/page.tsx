import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import {
  PublishHistory,
  type PublishHistoryRow,
} from "@/components/project/publish-history";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";

type Params = { params: Promise<{ projectId: string }> };

export default async function PublishHistoryPage({ params }: Params) {
  const { projectId } = await params;
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, subdomain")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: publishes } = await supabase
    .from("publishes")
    .select("id, status, created_at, live_at, pages_count, error_code")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

  const address = siteAddress(readPublishConfig(), project.subdomain);

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: data.currentTeam.name, href: "/dashboard" },
          { label: project.name, href: `/dashboard/projects/${project.id}` },
          { label: "Version history" },
        ]}
        title="Version history"
        description="Switch back to an earlier version if something is not right. Your pages stay saved."
        actions={
          <Link
            href={`/dashboard/projects/${project.id}`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
            Back to overview
          </Link>
        }
      />

      <PublishHistory
        projectId={project.id}
        rows={(publishes ?? []) as PublishHistoryRow[]}
        address={address}
      />
    </AppPage>
  );
}
