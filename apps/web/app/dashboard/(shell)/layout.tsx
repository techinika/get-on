import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineListener } from "@/components/offline-listener";
import { getShellData, getSidebarState } from "@/lib/dashboard";
import { getAssistantFeature } from "@/lib/agent/settings";

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

  const [sidebar, assistantFeature] = await Promise.all([
    getSidebarState(),
    getAssistantFeature(),
  ]);

  return (
    <ToastProvider>
      <AppShell
        user={data.user}
        teams={data.teams}
        currentTeam={data.currentTeam}
        projects={data.projects}
        usage={data.usage}
        assistant={data.assistant}
        assistantEnabled={assistantFeature.enabled}
        sidebar={sidebar}
      >
        {children}
      </AppShell>
      <OfflineListener />
    </ToastProvider>
  );
}
