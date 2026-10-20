import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardTopbar } from "@/components/shell/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineListener } from "@/components/offline-listener";
import type { PlanId } from "@/lib/plans";

export const instant = false;

function initialsFrom(name: string | null | undefined, email: string | undefined): string {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "U";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  const { data: team } = membership
    ? await supabase
        .from("teams")
        .select("id, name, plan_id")
        .eq("id", membership.team_id)
        .maybeSingle()
    : { data: null };

  const userName = profile?.full_name ?? user!.email ?? "Account";
  const planId = (team?.plan_id as PlanId | undefined) ?? "free";

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <DashboardTopbar
          teamName={team?.name ?? "Personal Team"}
          planId={planId}
          userName={userName}
          userEmail={user!.email ?? ""}
          initials={initialsFrom(profile?.full_name, user!.email)}
        />
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 lg:px-10">
          {children}
        </main>
      </div>
      <OfflineListener />
    </ToastProvider>
  );
}
