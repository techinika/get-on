import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";
import { SearchForm } from "./search-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let initial = {
    title: "",
    description: "",
    titleFormat: "{page} | {site}",
    twitterHandle: "",
    indexing: true,
  };
  let siteName = "";
  let siteUrl = "";
  if (current) {
    const supabase = await createClient();
    const [{ data: project }, { data: settings }] = await Promise.all([
      supabase
        .from("projects")
        .select("name, subdomain")
        .eq("id", projectId)
        .eq("team_id", current.team.teamId)
        .maybeSingle(),
      supabase
        .from("project_settings")
        .select("seo_site_title, seo_description, seo_title_format, twitter_handle, search_indexing")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);
    siteName = project?.name ?? "";
    if (project?.subdomain) {
      siteUrl = siteAddress(readPublishConfig(), project.subdomain);
    }
    initial = {
      title: settings?.seo_site_title ?? "",
      description: settings?.seo_description ?? "",
      titleFormat: settings?.seo_title_format ?? "{page} | {site}",
      twitterHandle: settings?.twitter_handle ?? "",
      indexing: settings?.search_indexing !== false,
    };
  }

  return (
    <div>
      <SettingsPageHeader
        title="Search appearance"
        description="Control how your website looks in Google and when someone shares your link."
        timing="publish"
      />
      <SearchForm projectId={projectId} initial={initial} siteName={siteName} siteUrl={siteUrl} />
    </div>
  );
}
