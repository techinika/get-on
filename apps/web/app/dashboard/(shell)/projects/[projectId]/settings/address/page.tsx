import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { readPublishConfig, siteAddress } from "@/lib/publishing/config";
import { AddressCard } from "./address-card";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let url = "";
  let published = false;
  if (current) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("subdomain, status")
      .eq("id", projectId)
      .eq("team_id", current.team.teamId)
      .maybeSingle();
    if (project?.subdomain) {
      url = siteAddress(readPublishConfig(), project.subdomain);
      published = project.status === "published";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsPageHeader
        title="Address"
        description="Your web address and sharing options."
        timing="right"
      />
      <AddressCard url={url} published={published} />
      <div className="max-w-[760px] rounded-card border border-border bg-surface-muted p-6">
        <h2 className="text-[17px] font-semibold text-text">Use your own domain</h2>
        <p className="mt-1 text-[15px] text-text-muted">
          Connecting a domain you already own is coming soon. For now, use the Get-On address above.
        </p>
        <span className="mt-3 inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-xs font-semibold text-text-muted">
          Coming soon
        </span>
      </div>
    </div>
  );
}
