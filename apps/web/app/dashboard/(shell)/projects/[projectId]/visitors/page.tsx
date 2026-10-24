import { AppCard } from "@/components/app/card";

type Params = { params: Promise<{ projectId: string }> };

export default async function VisitorsPage({ params }: Params) {
  const { projectId } = await params;
  return (
    <div>
      <header className="mb-6">
        <div className="text-sm text-text-muted">
          <a className="text-primary hover:underline" href={`/dashboard/projects/${projectId}`}>Project</a>
          {" / "}
          <span>Visitors</span>
        </div>
        <h1 className="mt-2 font-heading text-[28px] font-bold text-text">Visitors</h1>
        <p className="mt-1 text-[15px] text-text-muted">How many people visit your website.</p>
      </header>
      <AppCard className="max-w-[960px] p-6">
        <p className="text-[15px] text-text-muted">Visitors coming soon.</p>
      </AppCard>
    </div>
  );
}
