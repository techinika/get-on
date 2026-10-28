import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { getStaffSession } from "@/lib/admin";
import { getShellData, getSidebarState } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: "Staff | Get-On",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const data = await getShellData();
  if (!data) {
    redirect("/login");
  }

  const staff = await getStaffSession();
  if (!staff) {
    notFound();
  }
  if (!staff.mfaSatisfied) {
    redirect("/admin/setup-mfa");
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
