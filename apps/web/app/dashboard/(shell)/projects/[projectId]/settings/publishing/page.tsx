import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { PublishingForm } from "./publishing-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  return (
    <div>
      <SettingsPageHeader
        title="Publishing"
        description="Pause your website, 404 message and publishing options."
        timing="right"
      />
      <PublishingForm projectId={projectId} />
    </div>
  );
}
