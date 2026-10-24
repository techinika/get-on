import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";

type Params = { params: Promise<{ projectId: string }> };

export default async function VisitorsPage({ params }: Params) {
  const { projectId } = await params;
  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: "Project", href: `/dashboard/projects/${projectId}` },
          { label: "Visitors" },
        ]}
        title="Visitors"
        description="How many people visit your website."
      />
      <AppCard className="mt-6 p-6">
        <p className="text-[15px] text-text-muted">Visitor statistics coming soon.</p>
      </AppCard>
    </AppPage>
  );
}
