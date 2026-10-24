import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { RedirectsForm } from "./redirects-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let redirects: Array<{ id: string; from: string; to: string; code: number }> = [];
  if (current) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("redirects")
      .select("id, from_path, to_value, code")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    redirects = (data ?? []).map((row) => ({
      id: String(row.id),
      from: String(row.from_path),
      to: String(row.to_value ?? ""),
      code: Number(row.code ?? 301),
    }));
  }
  return (
    <div>
      <SettingsPageHeader
        title="Moved pages"
        description="When a page's address changes, send visitors from the old address to the new one."
        timing="right"
      />
      <RedirectsForm projectId={projectId} redirects={redirects} />
    </div>
  );
}
