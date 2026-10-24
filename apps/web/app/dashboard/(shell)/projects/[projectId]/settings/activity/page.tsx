import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { AppCard } from "@/components/app/card";

type Params = { params: Promise<{ projectId: string }> };

type ActivityRow = {
  id: string;
  event: string;
  summary: string;
  created_at: string;
};

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  let activity: ActivityRow[] = [];
  if (current) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("project_activity")
      .select("id, event, summary, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    activity = (data ?? []) as ActivityRow[];
  }

  return (
    <div>
      <SettingsPageHeader
        title="Activity"
        description="What has happened on this website."
        timing="right"
      />
      <AppCard className="max-w-[760px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-sm text-text-muted">Everything</span>
          <span className="text-sm text-text-muted">Last 30 days</span>
        </div>
        {activity.length === 0 ? (
          <div className="p-4 text-[15px] text-text-muted">Nothing has happened yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <p className="text-[15px] text-text">{item.summary}</p>
                <time className="text-sm text-text-muted" dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </div>
  );
}
