import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { PublishingForm } from "./publishing-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let initial = {
    paused: false,
    pauseTitle: "We will be back soon",
    pauseText: "This website is being updated. Please check again in a little while.",
    notFoundTitle: "Page not found",
    notFoundText: "That page does not exist. It may have been moved or removed.",
    notFoundButton: "Go to the homepage",
  };
  if (current) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("project_settings")
      .select("maintenance, custom_404")
      .eq("project_id", projectId)
      .maybeSingle();
    const maintenance =
      data?.maintenance && typeof data.maintenance === "object"
        ? (data.maintenance as Record<string, unknown>)
        : {};
    const notFound =
      data?.custom_404 && typeof data.custom_404 === "object"
        ? (data.custom_404 as Record<string, unknown>)
        : {};
    initial = {
      paused: maintenance.enabled === true,
      pauseTitle: typeof maintenance.title === "string" ? maintenance.title : initial.pauseTitle,
      pauseText: typeof maintenance.text === "string" ? maintenance.text : initial.pauseText,
      notFoundTitle: typeof notFound.title === "string" ? notFound.title : initial.notFoundTitle,
      notFoundText: typeof notFound.text === "string" ? notFound.text : initial.notFoundText,
      notFoundButton: typeof notFound.button === "string" ? notFound.button : initial.notFoundButton,
    };
  }

  return (
    <div>
      <SettingsPageHeader
        title="Publishing"
        description="Pause your website, page-not-found message and publishing options."
        timing="right"
      />
      <PublishingForm projectId={projectId} initial={initial} />
    </div>
  );
}
