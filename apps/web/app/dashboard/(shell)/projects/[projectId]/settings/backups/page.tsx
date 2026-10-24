import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { BackupsForm } from "./backups-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  await params;
  return (
    <div>
      <SettingsPageHeader
        title="Backups"
        description="Safe copies of your website you can go back to."
        timing="right"
      />
      <BackupsForm />
    </div>
  );
}
