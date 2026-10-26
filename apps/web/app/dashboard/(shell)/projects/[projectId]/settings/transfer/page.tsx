import { getShellData } from "@/lib/dashboard";
import { getCurrentTeam } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { TransferForm } from "./transfer-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const [data, current] = await Promise.all([getShellData(), getCurrentTeam()]);
  const teams = (data?.teams ?? [])
    .filter((team) => team.id !== current?.team.teamId)
    .map((team) => ({ id: team.id, name: team.name, role: team.role }));

  let pending: { id: string; email: string; expiresAt: string } | null = null;
  if (current) {
    const supabase = await createClient();
    const { data: transfer } = await supabase
      .from("ownership_transfers")
      .select("id, to_email, expires_at")
      .eq("project_id", projectId)
      .eq("from_team_id", current.team.teamId)
      .eq("status", "pending")
      .maybeSingle();
    if (transfer) {
      pending = {
        id: transfer.id,
        email: transfer.to_email ?? "someone",
        expiresAt: transfer.expires_at,
      };
    }
  }

  return (
    <div>
      <SettingsPageHeader
        title="Transfer this website"
        description="Move this website to another team. Everything on the website moves with it."
        timing="right"
      />
      <TransferForm projectId={projectId} teams={teams} pending={pending} />
    </div>
  );
}
