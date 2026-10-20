"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, FileText, Image, LayoutDashboard, Puzzle, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/components/project/types";

type TabIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean;
}>;

type TabKey = "overview" | "pages" | "images" | "plugins" | "settings";

type Tab = {
  key: TabKey;
  label: string;
  icon: TabIcon;
  soon?: boolean;
};

const TABS: Tab[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "pages", label: "Pages", icon: FileText },
  { key: "images", label: "Images", icon: Image, soon: true },
  { key: "plugins", label: "Plugins", icon: Puzzle, soon: true },
  { key: "settings", label: "Settings", icon: Settings, soon: true },
];

function StatusBadge({ status }: { status: ProjectSummary["status"] }) {
  if (status === "published") {
    return (
      <Badge variant="live" dot>
        Live
      </Badge>
    );
  }
  return <Badge variant="draft">Draft</Badge>;
}

export type ProjectChromeProps = {
  project: ProjectSummary;
  children: React.ReactNode;
};

export function ProjectChrome({ project, children }: ProjectChromeProps) {
  const pathname = usePathname();
  const base = `/dashboard/projects/${project.id}`;

  const activeKey: TabKey | null =
    pathname === base
      ? "overview"
      : pathname.startsWith(`${base}/pages`)
        ? "pages"
        : pathname.startsWith(`${base}/settings`)
          ? "settings"
          : null;

  const hrefFor = (key: TabKey) =>
    key === "pages" ? `${base}/pages` : key === "settings" ? `${base}/settings` : base;

  return (
    <div className="-mx-4 -mt-6 lg:-mx-10 lg:flex lg:items-stretch">
      {/* Desktop sidebar (sticky in flow — the outer container padding is
          cancelled with negative margins so the panel sits flush under the
          global top bar; see the report for the trade-offs). */}
      <aside className="hidden shrink-0 border-r border-border bg-surface lg:block lg:w-[248px]">
        <div className="sticky top-16 flex min-h-[calc(100vh-88px)] flex-col p-4">
          <Link
            href="/dashboard"
            className="flex h-11 items-center gap-2 rounded-input px-2 text-sm text-text-muted transition-colors hover:bg-surface-muted"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            All websites
          </Link>

          <div className="mt-2 py-3">
            <p className="truncate font-heading text-[18px] font-bold leading-tight">
              {project.name}
            </p>
            <p className="mt-1 truncate text-sm text-text-muted">{project.subdomain}.get-on.tech</p>
            <div className="mt-2">
              <StatusBadge status={project.status} />
            </div>
          </div>

          <nav aria-label="Website sections" className="mt-4 flex flex-col gap-1">
            {TABS.map((tab) => {
              const active = activeKey === tab.key;
              const Icon = tab.icon;
              const body = (
                <>
                  <Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-base font-medium">{tab.label}</span>
                  {tab.soon ? (
                    <Badge variant="neutral" className="shrink-0 text-[11px] font-bold">
                      Soon
                    </Badge>
                  ) : null}
                </>
              );
              const className = cn(
                "flex h-11 items-center gap-3 rounded-input px-3 transition-colors",
                active ? "bg-primary-soft text-primary font-semibold" : "text-text",
                !tab.soon && !active && "hover:bg-surface-muted",
                tab.soon && "opacity-60",
              );

              if (tab.soon) {
                return (
                  <span key={tab.key} className={className} aria-disabled="true">
                    {body}
                  </span>
                );
              }
              return (
                <Link
                  key={tab.key}
                  href={hrefFor(tab.key)}
                  className={className}
                  aria-current={active ? "page" : undefined}
                >
                  {body}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-16 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-2 lg:hidden">
          <Link
            href="/dashboard"
            aria-label="All websites"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text transition-colors hover:bg-surface-muted"
          >
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
          </Link>
          <p className="min-w-0 flex-1 truncate text-base font-bold">{project.name}</p>
          <div className="shrink-0 pr-1">
            <StatusBadge status={project.status} />
          </div>
        </header>

        <div className="px-5 pb-[88px] pt-5 lg:max-w-[960px] lg:pb-0 lg:pl-10 lg:pr-10 lg:pt-6">
          {children}
        </div>

        <nav
          aria-label="Website sections"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="grid grid-cols-5">
            {TABS.map((tab) => {
              const active = activeKey === tab.key;
              const Icon = tab.icon;
              const body = (
                <>
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-[2px] bg-primary"
                    />
                  ) : null}
                  <Icon size={22} strokeWidth={1.75} aria-hidden />
                  <span className="text-[11px] font-semibold leading-none">{tab.label}</span>
                </>
              );
              const className = cn(
                "relative flex h-16 w-full flex-col items-center justify-center gap-1.5 px-1",
                active ? "text-primary" : "text-text-muted",
                tab.soon && "opacity-60",
              );

              if (tab.soon) {
                return (
                  <li key={tab.key}>
                    <span className={className} aria-disabled="true">
                      {body}
                    </span>
                  </li>
                );
              }
              return (
                <li key={tab.key}>
                  <Link
                    href={hrefFor(tab.key)}
                    className={className}
                    aria-current={active ? "page" : undefined}
                  >
                    {body}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
