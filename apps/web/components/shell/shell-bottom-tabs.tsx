"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Ellipsis,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { ShellProject } from "@/components/shell/types";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
  className?: string;
}>;

type Tab = {
  key: string;
  label: string;
  icon: IconType;
  href?: string;
};

export function ShellBottomTabs({
  project,
  onOpenHelp,
}: {
  project: ShellProject | null;
  onOpenHelp?: () => void;
}) {
  const pathname = usePathname();
  const [hidden, setHidden] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  React.useEffect(() => {
    function update() {
      const viewport = window.visualViewport;
      if (!viewport) return;
      setHidden(window.innerHeight - viewport.height > 120);
    }
    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const dialog = document.querySelector('[role="dialog"]');
      setHidden(Boolean(dialog));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!moreOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const base = project ? `/dashboard/projects/${project.id}` : "/dashboard";
  const unread = project?.unreadMessages ?? 0;

  const tabs: Tab[] = project
    ? [
        { key: "overview", label: "Overview", icon: LayoutDashboard, href: base },
        { key: "pages", label: "Pages", icon: FileText, href: `${base}/pages` },
        { key: "pictures", label: "Pictures", icon: ImageIcon, href: `${base}/images` },
        { key: "templates", label: "Templates", icon: LayoutTemplate, href: `${base}/templates` },
        { key: "more", label: "More", icon: Ellipsis },
      ]
    : [
        { key: "websites", label: "Websites", icon: LayoutGrid, href: "/dashboard" },
        { key: "templates", label: "Templates", icon: LayoutTemplate, href: "/dashboard/templates" },
        { key: "team", label: "Team", icon: Users, href: "/dashboard/team" },
        { key: "plan", label: "Plan", icon: CreditCard, href: "/dashboard/plan" },
        { key: "account", label: "Account", icon: Users, href: "/dashboard/account" },
      ];

  return (
    <>
      <nav
        aria-label="Main"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] transition-transform duration-200 min-[1024px]:hidden",
          hidden ? "translate-y-full" : "translate-y-0",
        )}
      >
        <ul className={cn(project ? "grid-cols-5" : "grid-cols-5", "grid")}>
          {tabs.map((tab) => {
            const active =
              tab.href === "/dashboard" || tab.href === base
                ? pathname === tab.href
                : tab.href
                  ? pathname === tab.href || pathname.startsWith(`${tab.href}/`)
                  : moreOpen;
            const Icon = tab.icon;
            const content = (
              <>
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 mx-auto h-[3px] w-6 rounded-b-[3px] bg-primary"
                  />
                ) : null}
                <span className="relative">
                  <Icon size={22} strokeWidth={1.75} aria-hidden />
                  {tab.key === "more" && unread > 0 ? (
                    <span
                      aria-hidden
                      className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface"
                    />
                  ) : null}
                </span>
                <span className="text-[11px] font-semibold leading-none">{tab.label}</span>
              </>
            );

            return (
              <li key={tab.key}>
                {tab.href ? (
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                      active ? "text-primary" : "text-text-muted",
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-expanded={moreOpen}
                    className={cn(
                      "relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                      active ? "text-primary" : "text-text-muted",
                    )}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {moreOpen && project ? (
        <div className="fixed inset-0 z-50 flex items-end min-[1024px]:hidden">
          <div
            className="absolute inset-0 bg-scrim"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="relative w-full rounded-t-dialog bg-surface pb-[env(safe-area-inset-bottom)] shadow-raised"
          >
            <div className="flex h-14 items-center justify-between px-5">
              <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border-strong" />
              <h2 className="mt-2 text-lg font-bold text-text">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="mt-2 flex h-11 w-11 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
              >
                <X size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <ul>
              {project.contactEnabled ? (
                <li>
                  <Link
                    href={`${base}/messages`}
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-14 items-center gap-3 border-b border-border px-5 text-base font-semibold text-text"
                  >
                    <Mail size={22} strokeWidth={1.75} aria-hidden className="text-text-muted" />
                    <span className="flex-1">Messages</span>
                    {unread > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1.5 text-[11px] font-bold text-on-primary">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ) : null}
              <li>
                <Link
                  href={`${base}/templates`}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-14 items-center gap-3 border-b border-border px-5 text-base font-semibold text-text"
                >
                  <LayoutTemplate size={22} strokeWidth={1.75} aria-hidden className="text-text-muted" />
                  <span className="flex-1">Templates</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`${base}/settings`}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-14 items-center gap-3 border-b border-border px-5 text-base font-semibold text-text"
                >
                  <Settings size={22} strokeWidth={1.75} aria-hidden className="text-text-muted" />
                  <span className="flex-1">Settings</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-14 items-center gap-3 border-b border-border px-5 text-base font-semibold text-text"
                >
                  <LayoutGrid size={22} strokeWidth={1.75} aria-hidden className="text-text-muted" />
                  <span className="flex-1">All websites</span>
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenHelp?.();
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-5 text-left text-base font-semibold text-text"
                >
                  <HelpCircle size={22} strokeWidth={1.75} aria-hidden className="text-text-muted" />
                  <span className="flex-1">Help</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
