import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { SitemapForm } from "./sitemap-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  await params;
  return (
    <div>
      <SettingsPageHeader
        title="Sitemap and Google"
        description="Help search engines find all your pages, and connect Google&apos;s tools."
        timing="publish"
      />
      <SitemapForm />
    </div>
  );
}
