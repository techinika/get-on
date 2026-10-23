import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineListener } from "@/components/offline-listener";
import { getShellData, getSidebarState } from "@/lib/dashboard";
import { isAdminEmail } from "@/lib/admin";

/**
 * The persistent dashboard frame. This layout never unmounts while moving
 * between dashboard routes, so the top bar and sidebar survive navigation
 * (spec §7.1).
 */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const sidebar = await getSidebarState();

  return (
    <ToastProvider>
      <AppShell
        user={data.user}
        teams={data.teams}
        currentTeam={data.currentTeam}
        projects={data.projects}
        usage={data.usage}
        sidebar={sidebar}
        isAdmin={isAdminEmail(data.user.email)}
      >
        {children}
      </AppShell>
      <OfflineListener />
    </ToastProvider>
  );
}
