"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ShellTopBar } from "@/components/shell/shell-top-bar";
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellBottomTabs } from "@/components/shell/shell-bottom-tabs";
import { NavigationProgress } from "@/components/shell/navigation-progress";
import { QuickFind } from "@/components/shell/quick-find";
import { AssistantDock } from "@/components/agent/assistant-dock";
import type {
  ShellAssistant,
  ShellProject,
  ShellTeam,
  ShellUsage,
  ShellUser,
} from "@/components/shell/types";
import {
  ASSISTANT_DEFAULT_WIDTH,
  clampAssistantWidth,
  type AssistantTab,
} from "@/lib/agent/constants";
import { saveAssistantPreferences } from "@/lib/agent/preferences-client";
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
  assistant?: ShellAssistant;
  assistantEnabled?: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
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
  assistant,
  assistantEnabled = true,
  isAdmin = false,
  isSuperAdmin = false,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(sidebar === "collapsed");
  const [quickFindOpen, setQuickFindOpen] = React.useState(false);
  const [assistantOpen, setAssistantOpen] = React.useState(assistant?.open ?? false);
  const [assistantTab, setAssistantTab] = React.useState<AssistantTab>(
    assistantEnabled ? (assistant?.tab ?? "assistant") : "help",
  );
  const [assistantWidth, setAssistantWidth] = React.useState(
    assistant?.width ?? ASSISTANT_DEFAULT_WIDTH,
  );
  const quickFindButtonRef = React.useRef<HTMLButtonElement>(null);
  const assistantButtonRef = React.useRef<HTMLButtonElement>(null);
  const prefsMountedRef = React.useRef(false);

  const projectId = projectIdFromPath(pathname);
  const project = projectId ? (projects.find((item) => item.id === projectId) ?? null) : null;

  React.useEffect(() => {
    prefsMountedRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!prefsMountedRef.current) return;
    const timeout = window.setTimeout(() => {
      void saveAssistantPreferences({
        open: assistantOpen,
        tab: assistantTab,
        width: assistantWidth,
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [assistantOpen, assistantTab, assistantWidth]);

  function openAssistant(tab: AssistantTab = assistantEnabled ? "assistant" : "help") {
    setAssistantTab(tab);
    setAssistantOpen(true);
  }

  function toggleAssistant() {
    if (assistantOpen) {
      setAssistantOpen(false);
      return;
    }
    openAssistant(assistantEnabled ? "assistant" : "help");
  }

  const closeAssistant = React.useCallback(() => {
    setAssistantOpen(false);
    assistantButtonRef.current?.focus();
  }, []);

  const changeAssistantWidth = React.useCallback((value: number) => {
    setAssistantWidth(clampAssistantWidth(value));
  }, []);

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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setAssistantOpen((value) => !value);
        setAssistantTab(assistantEnabled ? "assistant" : "help");
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
  }, [assistantEnabled]);

  React.useEffect(() => {
    function openHelp() {
      setAssistantTab("help");
      setAssistantOpen(true);
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
        onOpenHelp={() => openAssistant("help")}
        assistantEnabled={assistantEnabled}
        assistantOpen={assistantOpen}
        onToggleAssistant={toggleAssistant}
        assistantButtonRef={assistantButtonRef}
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
        isSuperAdmin={isSuperAdmin}
        role={currentTeam.role}
      />

      <main
        id="main-content"
        className={cn(
          "min-h-[calc(100dvh-56px)] min-[640px]:min-h-[calc(100dvh-64px)] pt-14 min-[640px]:pt-16",
          "min-[1024px]:ml-[var(--sidebar-w)]",
          assistantOpen && "min-[1024px]:pr-[var(--assistant-w)]",
        )}
        style={{ "--assistant-w": `${assistantWidth}px` } as React.CSSProperties}
      >
        {children}
      </main>

      <ShellBottomTabs project={project} onOpenHelp={() => openAssistant("help")} />

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

      <AssistantDock
        open={assistantOpen}
        tab={assistantTab}
        width={assistantWidth}
        enabled={assistantEnabled}
        role={currentTeam.role}
        teamId={currentTeam.id}
        planId={currentTeam.planId}
        teamName={currentTeam.name}
        userId={user.id}
        projectId={projectId}
        projectName={project?.name ?? ""}
        credits={usage.aiCredits ?? 0}
        onClose={closeAssistant}
        onTabChange={setAssistantTab}
        onWidthChange={changeAssistantWidth}
        returnFocusRef={assistantButtonRef}
      />
    </div>
  );
}
