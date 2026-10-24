import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { SearchForm } from "./search-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  await params;
  return (
    <div>
      <SettingsPageHeader
        title="Search appearance"
        description="Control how your website looks in Google and when someone shares your link."
        timing="publish"
      />
      <SearchForm />
    </div>
  );
}
