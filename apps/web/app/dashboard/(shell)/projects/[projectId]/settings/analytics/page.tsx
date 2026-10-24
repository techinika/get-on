import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { AnalyticsForm } from "./analytics-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let initial = {
    visitors: true,
    gaEnabled: false,
    gaId: "",
    gaConsent: "ask",
  };
  if (current) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("project_settings")
      .select("stats_enabled, ga")
      .eq("project_id", projectId)
      .maybeSingle();
    const ga =
      data?.ga && typeof data.ga === "object" ? (data.ga as Record<string, unknown>) : {};
    initial = {
      visitors: data?.stats_enabled !== false,
      gaEnabled: ga.enabled === true,
      gaId: typeof ga.measurementId === "string" ? ga.measurementId : "",
      gaConsent: ga.consent === "all" ? "all" : "ask",
    };
  }

  return (
    <div>
      <SettingsPageHeader
        title="Visitors and analytics"
        description="See how many people visit your website, and connect Google Analytics if you use it."
        timing="publish"
      />
      <AnalyticsForm projectId={projectId} initial={initial} />
    </div>
  );
}
