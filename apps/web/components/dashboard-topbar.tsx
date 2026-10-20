"use client";

import { usePathname } from "next/navigation";
import { HelpPanel } from "@/components/help-panel";

type DashboardTopbarProps = {
  teamName: string;
  planName: string;
  userEmail?: string;
};

export function DashboardTopbar({
  teamName,
  planName,
  userEmail,
}: DashboardTopbarProps) {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-lg font-bold text-[var(--color-primary)]">Get-On</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">{teamName}</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpPanel
            teamName={teamName}
            planName={planName}
            currentPage={pathname}
          />
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm hover:bg-[var(--color-muted)]"
            >
              Log out
            </button>
          </form>
          {userEmail ? (
            <span className="hidden text-xs text-[var(--color-muted-foreground)] sm:inline">
              {userEmail}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
