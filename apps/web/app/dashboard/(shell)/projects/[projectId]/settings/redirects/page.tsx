import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { RedirectsForm } from "./redirects-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  await params;
  return (
    <div>
      <SettingsPageHeader
        title="Moved pages"
        description="When a page&apos;s address changes, send visitors from the old address to the new one."
        timing="right"
      />
      <RedirectsForm />
    </div>
  );
}
