"use client";

import * as React from "react";
import { ChevronDown, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/logo";
import { HelpButton, HelpPanel } from "@/components/shell/help-panel";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import type { PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

const PLAN_BADGE: Record<PlanId, { label: string; variant: "neutral" | "primary" | "accent" }> = {
  free: { label: "Free", variant: "neutral" },
  basic: { label: "Basic", variant: "primary" },
  pro: { label: "Pro", variant: "primary" },
  enterprise: { label: "Enterprise", variant: "accent" },
};

export type DashboardTopbarProps = {
  teamName: string;
  planId: PlanId;
  userName: string;
  userEmail: string;
  initials: string;
};

export function DashboardTopbar({ teamName, planId, userName, userEmail, initials }: DashboardTopbarProps) {
  const [helpOpen, setHelpOpen] = React.useState(false);
  const helpButtonRef = React.useRef<HTMLButtonElement>(null);
  const plan = PLAN_BADGE[planId];

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" aria-label="Get-On dashboard" className="flex shrink-0 items-center">
            <LogoMark />
          </Link>
          <span aria-hidden className="hidden text-text-muted xs:inline">
            /
          </span>
          <Menu
            label="Switch team"
            align="left"
            trigger={(props) => (
              <button
                type="button"
                {...props}
                className="inline-flex h-11 max-w-[180px] items-center gap-2 rounded-input px-2 font-body text-base text-text transition-colors hover:bg-surface-muted"
              >
                <Users size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
                <span className="truncate font-semibold">{teamName}</span>
                <ChevronDown size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
              </button>
            )}
          >
            <div className="px-3 py-2 text-sm font-semibold">{teamName}</div>
            <MenuSeparator />
            <MenuItem disabled aria-disabled="true" className="text-text-muted">
              Create another team (coming soon)
            </MenuItem>
          </Menu>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={plan.variant} className="hidden xs:inline-flex">
            {plan.label}
          </Badge>
          <HelpButton buttonRef={helpButtonRef} onClick={() => setHelpOpen(true)} />
          <Menu
            label="Account"
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label={`Account menu for ${userName}`}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft font-body text-sm font-bold text-accent-text",
                )}
              >
                {initials}
              </button>
            )}
          >
            <div className="px-3 py-3">
              <p className="text-base font-semibold">{userName}</p>
              <p className="text-sm text-text-muted">{userEmail}</p>
            </div>
            <MenuSeparator />
            <div className="px-3 py-2">
              <p className="mb-1 text-sm font-semibold text-text-muted">Theme</p>
              <ThemeToggle />
            </div>
            <MenuSeparator />
            <form action="/auth/logout" method="post">
              <MenuItem type="submit" destructive className="w-full">
                <LogOut size={20} strokeWidth={1.75} aria-hidden />
                Log out
              </MenuItem>
            </form>
          </Menu>
        </div>
      </header>

      <HelpPanel
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
          helpButtonRef.current?.focus();
        }}
        planId={planId}
        teamName={teamName}
      />
    </>
  );
}
