import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardTopbar } from "@/components/dashboard-topbar";

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("role, team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: team } = teamMember
    ? await supabase
        .from("teams")
        .select("id, name, plan_id, plans(name)")
        .eq("id", teamMember.team_id)
        .maybeSingle()
    : { data: null };

  const teamName = team?.name ?? "Personal Team";
  const planName = ((team?.plans as { name?: string } | null)?.name ?? "Free").toString();

  return (
    <div className="min-h-screen">
      <DashboardTopbar teamName={teamName} planName={planName} userEmail={user.email} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
