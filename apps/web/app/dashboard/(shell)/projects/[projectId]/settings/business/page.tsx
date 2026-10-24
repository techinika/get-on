import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { BusinessForm } from "./business-form";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";

type Params = { params: Promise<{ projectId: string }> };

export default async function BusinessSettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let initial: {
    name: string;
    tagline: string;
    timezone: string;
    themeColor: string;
    twitterHandle: string;
    addressParts: Record<string, string>;
  } = {
    name: "",
    tagline: "",
    timezone: "UTC",
    themeColor: "",
    twitterHandle: "",
    addressParts: {},
  };

  if (current) {
    const supabase = await createClient();
    const [{ data: project }, { data: settings }] = await Promise.all([
      supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .eq("team_id", current.team.teamId)
        .maybeSingle(),
      supabase
        .from("project_settings")
        .select("tagline, timezone, theme_color, twitter_handle, address_parts")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);
    const address =
      settings?.address_parts && typeof settings.address_parts === "object"
        ? (settings.address_parts as Record<string, string>)
        : {};
    initial = {
      name: project?.name ?? "",
      tagline: settings?.tagline ?? "",
      timezone: settings?.timezone ?? "UTC",
      themeColor: settings?.theme_color ?? "",
      twitterHandle: settings?.twitter_handle ?? "",
      addressParts: address,
    };
  }

  return (
    <div>
      <SettingsPageHeader
        title="Business"
        description="Your business name, contact details and how it appears."
        timing="publish"
      />
      <BusinessForm projectId={projectId} initial={initial} />
    </div>
  );
}
