import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";

export default function TemplatesPage() {
  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[{ label: "Templates" }]}
        title="Templates"
        description="Ready-made designs for your website. Pick one and make it yours."
      />
      <div className="rounded-card border border-border bg-surface p-6 text-center">
        <p className="text-base text-text-muted">
          Templates are available. The gallery is being prepared with system templates.
        </p>
      </div>
    </AppPage>
  );
}
