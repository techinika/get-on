import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { AppCard } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/relative-time";
import { can } from "@/lib/permissions";

type Params = { params: Promise<{ projectId: string }> };

type ActivityRow = {
  id: string;
  occurred_at: string;
  count: number;
  actor_user_id: string | null;
  actor_name: string;
  actor_role: string | null;
  category: string;
  event: string;
  summary: string;
  project_name: string | null;
  target_name: string | null;
  meta: Record<string, unknown> | null;
  client: string | null;
};

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  if (!current) notFound();
  if (!can(current.team.role, "site.activity")) notFound();

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, deleted_at")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!project) notFound();

  const { data } = await supabase
    .from("team_activity")
    .select("id, occurred_at, count, actor_user_id, actor_name, actor_role, category, event, summary, project_name, target_name, meta, client")
    .eq("team_id", current.team.teamId)
    .eq("project_id", projectId)
    .order("occurred_at", { ascending: false })
    .limit(50);
  const activity = (data ?? []) as ActivityRow[];

  return (
    <div>
      <SettingsPageHeader
        title="Activity"
        description="What has happened on this website."
        timing="right"
      />
      {project.deleted_at ? (
        <div className="mb-4 max-w-[760px] rounded-info bg-warning-soft p-4 text-sm text-warning-text">
          This website was deleted. Its history stays here. Restore it from the Recently deleted card on your dashboard if there is room.
        </div>
      ) : null}
      <AppCard className="max-w-[760px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-sm text-text-muted">Everything</span>
          <span className="text-sm text-text-muted">Latest first</span>
        </div>
        {activity.length === 0 ? (
          <div className="p-4 text-[15px] text-text-muted">Nothing has happened yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((row) => (
              <li key={row.id} className="flex min-h-16 items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-surface-muted text-text-muted">
                  <History size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-text">{row.summary}</p>
                    {row.actor_user_id === current.user.id ? <Badge>You</Badge> : null}
                    {row.count > 1 ? <Badge>{row.count} times</Badge> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
                    <span>{relativeTime(row.occurred_at)}</span>
                    {row.client ? <span>from {row.client}</span> : null}
                  </div>
                  <details className="mt-2">
                    <summary className="w-fit cursor-pointer text-[13px] font-semibold text-primary">
                      Details
                    </summary>
                    <dl className="mt-2 grid gap-1.5 text-[13px] sm:grid-cols-[160px_1fr]">
                      <dt className="text-text-muted">Who</dt>
                      <dd className="text-text">
                        {row.actor_name}
                        {row.actor_role ? ` · ${row.actor_role}` : ""}
                      </dd>
                      <dt className="text-text-muted">What happened</dt>
                      <dd className="text-text">{row.event.replaceAll("_", " ").replaceAll(".", " ")}</dd>
                      {row.target_name ? (
                        <>
                          <dt className="text-text-muted">What</dt>
                          <dd className="text-text">{row.target_name}</dd>
                        </>
                      ) : null}
                      {row.meta && Object.keys(row.meta).length > 0 ? (
                        <>
                          <dt className="text-text-muted">More</dt>
                          <dd className="text-text">
                            {Object.entries(row.meta).map(([key, value]) => (
                              <span key={key} className="mr-3 inline-block">
                                {key.replaceAll("_", " ")}: {String(value)}
                              </span>
                            ))}
                          </dd>
                        </>
                      ) : null}
                    </dl>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </div>
  );
}
