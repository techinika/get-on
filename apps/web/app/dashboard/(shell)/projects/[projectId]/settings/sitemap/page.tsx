import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { SitemapForm } from "./sitemap-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let initial = {
    gscTag: "",
    gscFile: "",
    bing: "",
    includeImages: true,
  };
  if (current) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("project_settings")
      .select("verification, sitemap_include_images")
      .eq("project_id", projectId)
      .maybeSingle();
    const verification =
      data?.verification && typeof data.verification === "object"
        ? (data.verification as Record<string, string>)
        : {};
    initial = {
      gscTag: verification.gscTag ?? "",
      gscFile: verification.gscFile ?? "",
      bing: verification.bing ?? "",
      includeImages: data?.sitemap_include_images !== false,
    };
  }

  return (
    <div>
      <SettingsPageHeader
        title="Sitemap and Google"
        description="Help search engines find all your pages, and connect Google's tools."
        timing="publish"
      />
      <SitemapForm projectId={projectId} initial={initial} />
    </div>
  );
}
