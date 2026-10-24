import { getShellData } from "@/lib/dashboard";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { TransferForm } from "./transfer-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const [data, current] = await Promise.all([getShellData(), getCurrentTeam()]);
  const teams = (data?.teams ?? [])
    .filter((team) => team.id !== current?.team.teamId)
    .map((team) => ({ id: team.id, name: team.name, role: team.role }));
  return (
    <div>
      <SettingsPageHeader
        title="Transfer this website"
        description="Move this website to another team. Everything on the website moves with it."
        timing="right"
      />
      <TransferForm projectId={projectId} teams={teams} />
    </div>
  );
}
