import { BusinessForm } from "./business-form";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";

type Params = { params: Promise<{ projectId: string }> };

export default async function BusinessSettingsPage({ params }: Params) {
  const { projectId } = await params;
  return (
    <div>
      <SettingsPageHeader
        title="Business"
        description="Your business name, contact details and how it appears."
        timing="publish"
      />
      <BusinessForm projectId={projectId} />
    </div>
  );
}
