import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { DeleteForm } from "./delete-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  return (
    <div>
      <SettingsPageHeader
        title="Delete this website"
        description="This takes your website offline. You can get it back for 14 days."
        timing="right"
      />
      <DeleteForm projectId={projectId} />
    </div>
  );
}
