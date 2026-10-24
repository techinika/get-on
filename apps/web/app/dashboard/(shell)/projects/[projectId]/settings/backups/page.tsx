import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { BackupsForm } from "./backups-form";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let backups: Array<{
    id: string;
    kind: string;
    label: string | null;
    status: string;
    pageCount: number | null;
    picturesIncluded: boolean | null;
    createdAt: string;
  }> = [];
  if (current) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("backups")
      .select("id, kind, label, status, page_count, pictures_included, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(25);
    backups = (data ?? []).map((row) => ({
      id: String(row.id),
      kind: String(row.kind),
      label: row.label ? String(row.label) : null,
      status: String(row.status),
      pageCount: row.page_count === null ? null : Number(row.page_count),
      picturesIncluded: row.pictures_included === null ? null : Boolean(row.pictures_included),
      createdAt: String(row.created_at),
    }));
  }

  return (
    <div>
      <SettingsPageHeader
        title="Backups"
        description="Safe copies of your website you can go back to."
        timing="right"
      />
      <BackupsForm projectId={projectId} backups={backups} />
    </div>
  );
}
