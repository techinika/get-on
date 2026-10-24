import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { ActivityList } from "./activity-list";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  await params;
  return (
    <div>
      <SettingsPageHeader
        title="Activity"
        description="What has happened on this website."
        timing="right"
      />
      <ActivityList />
    </div>
  );
}
