"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ShellTopBar } from "@/components/shell/shell-top-bar";
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellBottomTabs } from "@/components/shell/shell-bottom-tabs";
import { NavigationProgress } from "@/components/shell/navigation-progress";
import { QuickFind } from "@/components/shell/quick-find";
import { HelpPanel } from "@/components/shell/help-panel";
import type {
  ShellProject,
  ShellTeam,
  ShellUsage,
  ShellUser,
} from "@/components/shell/types";
import { cn } from "@/lib/utils";

export const SIDEBAR_COOKIE = "gs_sidebar";

export type AppShellProps = {
  user: ShellUser;
  teams: ShellTeam[];
  currentTeam: ShellTeam;
  projects: ShellProject[];
  usage: ShellUsage;
  /** Server-rendered sidebar state (from the `gs_sidebar` cookie). */
  sidebar: "expanded" | "collapsed";
  isAdmin?: boolean;
  children: React.ReactNode;
};

function projectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * The persistent dashboard frame (spec §5.1): fixed top bar, fixed sidebar,
 * mobile tab bar and the shared overlays. It never unmounts while moving
 * between dashboard routes.
 */
export function AppShell({
  user,
  teams,
  currentTeam,
  projects,
  usage,
  sidebar,
  isAdmin = false,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(sidebar === "collapsed");
  const [quickFindOpen, setQuickFindOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const quickFindButtonRef = React.useRef<HTMLButtonElement>(null);

  const projectId = projectIdFromPath(pathname);
  const project = projectId ? (projects.find((item) => item.id === projectId) ?? null) : null;

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickFindOpen(true);
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setQuickFindOpen(true);
        return;
      }
      if (event.key === "[" && !typing) {
        event.preventDefault();
        toggleSidebar();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    function openHelp() {
      setHelpOpen(true);
    }
    window.addEventListener("get-on:help", openHelp);
    return () => window.removeEventListener("get-on:help", openHelp);
  }, []);

  return (
    <div
      className="min-h-screen bg-app-bg"
      style={{ "--sidebar-w": collapsed ? "72px" : "248px" } as React.CSSProperties}
    >
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[70] hidden h-11 items-center rounded-input bg-primary px-4 text-base font-semibold text-on-primary focus:flex"
      >
        Skip to content
      </a>

      <ShellTopBar
        user={user}
        teams={teams}
        currentTeamId={currentTeam.id}
        project={project}
        onOpenQuickFind={() => setQuickFindOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        quickFindButtonRef={quickFindButtonRef}
      />

      <ShellSidebar
        projects={projects}
        usage={usage}
        planId={currentTeam.planId}
        project={project}
        collapsed={collapsed}
        onToggleCollapsed={toggleSidebar}
        isAdmin={isAdmin}
        role={currentTeam.role}
      />

      <main
        id="main-content"
        className={cn(
          "min-h-[calc(100dvh-56px)] min-[640px]:min-h-[calc(100dvh-64px)] pt-14 min-[640px]:pt-16",
          "min-[1024px]:ml-[var(--sidebar-w)]",
        )}
      >
        {children}
      </main>

      <ShellBottomTabs project={project} onOpenHelp={() => setHelpOpen(true)} />

      <NavigationProgress />

      <QuickFind
        open={quickFindOpen}
        onClose={() => {
          setQuickFindOpen(false);
          quickFindButtonRef.current?.focus();
        }}
        projectId={projectId ?? undefined}
        returnFocusRef={quickFindButtonRef}
      />

      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        planId={currentTeam.planId}
        teamName={currentTeam.name}
      />
    </div>
  );
}
