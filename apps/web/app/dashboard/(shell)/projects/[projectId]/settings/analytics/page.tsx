import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { AnalyticsForm } from "./analytics-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  await params;
  return (
    <div>
      <SettingsPageHeader
        title="Visitors and analytics"
        description="See how many people visit your website, and connect Google Analytics if you use it."
        timing="publish"
      />
      <AnalyticsForm />
    </div>
  );
}
