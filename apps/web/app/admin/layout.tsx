import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { isAdminEmail } from "@/lib/admin";
import { getShellData, getSidebarState } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: "Admin | Get-On",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }
  if (!isAdminEmail(data.user.email)) {
    notFound();
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
        isAdmin
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
