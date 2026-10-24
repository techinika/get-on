"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, Search } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { TeamSwitcher } from "@/components/shell/team-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { Badge } from "@/components/ui/badge";
import { useMediaQuery } from "@/lib/use-media-query";
import type { ShellProject, ShellTeam, ShellUser } from "@/components/shell/types";
import { cn } from "@/lib/utils";

export type ShellTopBarProps = {
  user: ShellUser;
  teams: ShellTeam[];
  currentTeamId: string;
  project: ShellProject | null;
  onOpenQuickFind: () => void;
  onOpenHelp: () => void;
  quickFindButtonRef: React.RefObject<HTMLButtonElement | null>;
};

/** Top bar of the app shell (spec §5.2). */
export function ShellTopBar({
  user,
  teams,
  currentTeamId,
  project,
  onOpenQuickFind,
  onOpenHelp,
  quickFindButtonRef,
}: ShellTopBarProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isWide = useMediaQuery("(min-width: 1280px)");

  const showHelpButton = !isMobile;

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 min-[640px]:h-16 min-[1024px]:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {isMobile && project ? (
          <>
            <Link
              href="/dashboard"
              aria-label="Back to my websites"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text transition-colors hover:bg-row-hover"
            >
              <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
            </Link>
            <span className="min-w-0 flex-1 truncate text-base font-semibold text-text">
              {project.name}
            </span>
            {project.status === "published" ? (
              <Badge variant="live" dot>
                Live
              </Badge>
            ) : (
              <Badge variant="draft">Draft</Badge>
            )}
          </>
        ) : (
          <>
            <Link
              href="/dashboard"
              aria-label="GET-ON dashboard"
              className="flex shrink-0 items-center text-text"
            >
              <Wordmark className="h-6 w-auto min-[640px]:h-7" />
            </Link>
            <span aria-hidden className="hidden h-6 w-px bg-border min-[1024px]:block" />
            <div className={cn(isMobile && project ? "hidden" : "block", "min-w-0")}>
              <TeamSwitcher teams={teams} currentTeamId={currentTeamId} compact={isMobile} />
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isDesktop ? (
          <button
            type="button"
            ref={quickFindButtonRef}
            onClick={onOpenQuickFind}
            className="flex h-10 w-full max-w-[360px] flex-1 items-center gap-2 rounded-input border border-border bg-surface-muted px-3 text-left transition-colors hover:bg-row-hover"
          >
            <Search size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-text-muted" />
            <span className="flex-1 text-[15px] text-text-muted">Search</span>
            <kbd className="shrink-0 rounded-[6px] bg-kbd-bg px-1.5 py-0.5 text-xs font-semibold text-text-muted">
              Ctrl K
            </kbd>
          </button>
        ) : (
          <button
            type="button"
            ref={quickFindButtonRef}
            onClick={onOpenQuickFind}
            aria-label="Search"
            className="flex h-11 w-11 items-center justify-center rounded-input text-text transition-colors hover:bg-row-hover"
          >
            <Search size={20} strokeWidth={1.75} aria-hidden />
          </button>
        )}

        {showHelpButton ? (
          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="Help"
            className="flex h-11 items-center justify-center gap-2 rounded-input px-2 text-text transition-colors hover:bg-row-hover min-[1280px]:px-3"
          >
            <LifeBuoy size={20} strokeWidth={1.75} aria-hidden />
            {isWide ? <span className="text-base font-semibold">Help</span> : null}
          </button>
        ) : null}

        <UserMenu user={user} onOpenHelp={onOpenHelp} showHelpInMenu={isMobile} />
      </div>
    </header>
  );
}
