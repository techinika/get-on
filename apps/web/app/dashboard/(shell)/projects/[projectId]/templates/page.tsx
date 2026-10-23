import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";

type Params = { params: Promise<{ projectId: string }> };

export default async function ProjectTemplatesPage({ params }: Params) {
  const { projectId } = await params;
  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: "Project", href: `/dashboard/projects/${projectId}` },
          { label: "Templates" },
        ]}
        title="Templates"
        description="Choose a template to use on this website."
      />
      <div className="rounded-card border border-border bg-surface p-6 text-center">
        <p className="text-base text-text-muted">Template gallery coming soon to this project.</p>
      </div>
    </AppPage>
  );
}
