import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { TransferForm } from "./transfer-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  await params;
  return (
    <div>
      <SettingsPageHeader
        title="Transfer this website"
        description="Move this website to another team. Everything on the website moves with it."
        timing="right"
      />
      <TransferForm />
    </div>
  );
}
