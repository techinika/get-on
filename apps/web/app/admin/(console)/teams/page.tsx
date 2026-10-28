import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listTeams } from "@/lib/admin";
import { canStaff, requireStaff } from "@/lib/admin/staff";
import { RequestApprovalLink } from "@/components/admin/request-approval-link";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/relative-time";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

type TeamRow = {
  id: string;
  name: string;
  plan_id: string;
  plan_source: string;
  is_personal: boolean;
  created_at: string;
  members: number;
  websites: number;
  billing_status: string | null;
  open_cases: number;
};

export default async function AdminTeamsPage() {
  const staff = await requireStaff();
  const canDirectPlan = canStaff(staff.role, "access.free.direct");
  const canRequestPlan = canStaff(staff.role, "access.free.request");
  const [teams, plansResult] = await Promise.all([
    listTeams(200) as Promise<TeamRow[]>,
    (async () => {
      const supabase = await createClient();
      return supabase.from("plans").select("id, name").order("rank", { ascending: true });
    })(),
  ]);
  const plans = (plansResult.data ?? []) as Array<{ id: string; name: string }>;

  return (
    <AppPage width="default">
      <PageHeader
        title="Teams"
        description="Every team, its plan and how much it is using."
        actions={
          <Link href="/admin" className={buttonVariants({ variant: "secondary", size: "md" })}>
            Back to overview
          </Link>
        }
      />
      {teams.length === 0 ? (
        <AppCard className="p-6">
          <p className="text-base text-text-muted">No teams yet.</p>
        </AppCard>
      ) : (
        <div className="flex flex-col gap-3">
          {teams.map((team) => (
            <AppCard key={team.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[16px] font-semibold text-text">{team.name}</p>
                    <Badge variant="primary">
                      {plans.find((plan) => plan.id === team.plan_id)?.name ?? team.plan_id}
                    </Badge>
                    {team.plan_source === "manual" ? <Badge variant="info">Set by support</Badge> : null}
                    {team.is_personal ? <Badge variant="neutral">Personal</Badge> : null}
                    {team.billing_status ? <Badge variant="neutral">{team.billing_status}</Badge> : null}
                  </div>
                  <p className="mt-1 text-[13px] text-text-muted">
                    Created {relativeTime(team.created_at)}
                  </p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {team.members} active {team.members === 1 ? "member" : "members"} ·{" "}
                    {team.websites} {team.websites === 1 ? "website" : "websites"} ·{" "}
                    {team.open_cases} open {team.open_cases === 1 ? "case" : "cases"}
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                {canDirectPlan ? (
                  <PlanForm teamId={team.id} planId={team.plan_id} plans={plans} />
                ) : canRequestPlan ? (
                  <RequestApprovalLink
                    kind="plan_change"
                    targetId={team.id}
                    planId={team.plan_id}
                    label="Request plan change"
                    size="sm"
                  />
                ) : (
                  <p className="text-[13px] text-text-muted">
                    You cannot change this team&apos;s plan.
                  </p>
                )}
              </div>
            </AppCard>
          ))}
        </div>
      )}
    </AppPage>
  );
}
