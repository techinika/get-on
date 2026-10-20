import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";

export const instant = false;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: team } = teamMember
    ? await supabase
        .from("teams")
        .select("id, name, plan_id")
        .eq("id", teamMember.team_id)
        .maybeSingle()
    : { data: null };

  const plan = PLAN_BY_ID[(team?.plan_id as PlanId | undefined) ?? "free"];

  const { count: projectCount } = team
    ? await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("team_id", team.id)
    : { count: 0 };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h1 className="text-2xl">{team?.name ?? "Personal Team"}</h1>
        <p className="mt-2 inline-flex rounded-full bg-[var(--color-muted)] px-3 py-1 text-xs font-semibold">
          {plan.name}
        </p>
        <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">
          {projectCount ?? 0} of {plan.maxWebsites ?? "∞"} websites
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <h2 className="text-xl">No websites yet</h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Your first website will show up here.
        </p>
        <Link
          href="/dashboard/projects/new"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-primary-foreground)]"
        >
          Create your first website
        </Link>
      </section>
    </div>
  );
}
