import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { relativeTime } from "@/lib/relative-time";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

type TeamRow = {
  id: string;
  name: string;
  plan_id: string;
  plan_source: string;
  is_personal: boolean;
  owner_id: string;
  created_at: string;
};

export default async function AdminTeamsPage() {
  const admin = createAdminClient();
  const [{ data: teams }, { data: plans }, { data: members }, { data: projects }, { data: invites }] =
    await Promise.all([
      admin.from("teams").select("id, name, plan_id, plan_source, is_personal, owner_id, created_at").order("created_at", { ascending: false }).limit(500),
      admin.from("plans").select("id, name").order("price_usd_monthly", { ascending: true }),
      admin.from("team_members").select("team_id, user_id, role, status"),
      admin.from("projects").select("team_id, deleted_at"),
      admin.from("team_invitations").select("team_id, status").eq("status", "pending"),
    ]);

  const ownerIds = [...new Set((teams ?? []).map((team) => team.owner_id))];
  const { data: profiles } = ownerIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", ownerIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile] as const));
  const planRows = (plans ?? []) as Array<{ id: string; name: string }>;

  return (
    <AppPage width="default">
      <PageHeader
        title="Teams"
        description="Every team, its plan and how much it is using."
        actions={
          <div className="flex gap-2">
            <Link href="/admin/referrals" className={buttonVariants({ variant: "ghost", size: "md" })}>Referrals</Link>
            <Link href="/admin" className={buttonVariants({ variant: "secondary", size: "md" })}>Back to admin</Link>
          </div>
        }
      />
      <div className="flex flex-col gap-3">
        {(teams ?? []).map((team: TeamRow) => {
          const teamMembers = (members ?? []).filter((member) => member.team_id === team.id);
          const active = teamMembers.filter((member) => member.status === "active").length;
          const teamProjects = (projects ?? []).filter((project) => project.team_id === team.id);
          const live = teamProjects.filter((project) => !project.deleted_at).length;
          const deleted = teamProjects.length - live;
          const pendingInvites = (invites ?? []).filter((invite) => invite.team_id === team.id).length;
          const owner = profileById.get(team.owner_id);
          return (
            <AppCard key={team.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[16px] font-semibold text-text">{team.name}</p>
                    <Badge variant="primary">{planRows.find((plan) => plan.id === team.plan_id)?.name ?? team.plan_id}</Badge>
                    {team.plan_source === "manual" ? <Badge variant="info">Set by support</Badge> : null}
                    {team.is_personal ? <Badge variant="neutral">Personal</Badge> : null}
                  </div>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {owner?.full_name ?? owner?.email ?? "No owner"} · joined {relativeTime(team.created_at)}
                  </p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {active} active {active === 1 ? "member" : "members"}
                    {pendingInvites ? ` · ${pendingInvites} invited` : ""} · {live} {live === 1 ? "website" : "websites"}
                    {deleted ? ` · ${deleted} deleted` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <PlanForm teamId={team.id} planId={team.plan_id} plans={planRows} />
              </div>
            </AppCard>
          );
        })}
      </div>
    </AppPage>
  );
}
