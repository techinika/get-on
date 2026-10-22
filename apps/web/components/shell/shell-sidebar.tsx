"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  CircleCheck,
  CreditCard,
  Eye,
  FileText,
  Gift,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  Rocket,
  Settings,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";
import { ShellMenu } from "@/components/shell/shell-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PLAN_BADGE } from "@/components/shell/plan-badge";
import type { ShellProject, ShellUsage } from "@/components/shell/types";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean;
}>;

type NavEntry = {
  key: string;
  label: string;
  icon: IconType;
  href?: string;
  soon?: boolean;
};

function NavLink({
  entry,
  active,
  collapsed,
}: {
  entry: NavEntry;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = entry.icon;
  const body = (
    <>
      {active ? (
        <span
          aria-hidden
          className="absolute -left-3 top-3 h-5 w-[3px] rounded-r-[3px] bg-primary"
        />
      ) : null}
      <Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <span className={cn("min-w-0 flex-1 truncate", collapsed ? "sr-only" : undefined)}>
        {entry.label}
      </span>
      {entry.soon && !collapsed ? (
        <span className="shrink-0 rounded-pill bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-text-muted">
          Soon
        </span>
      ) : null}
    </>
  );

  const classes = cn(
    "group relative flex h-11 items-center gap-3 rounded-input px-3 transition-colors",
    active ? "bg-primary-soft font-semibold text-primary" : "text-text",
    !entry.soon && !active && "hover:bg-row-hover",
    entry.soon && "opacity-60",
    collapsed && "mx-auto w-12 justify-center px-0",
  );

  if (entry.soon || !entry.href) {
    return (
      <span className={classes} aria-disabled="true" title={collapsed ? `${entry.label} (coming soon)` : undefined}>
        {body}
        {collapsed ? (
          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1F1A17] px-2.5 py-1.5 text-[13px] font-semibold text-white opacity-0 transition-opacity delay-300 group-hover:opacity-100 group-focus-within:opacity-100 min-[1024px]:block">
            {entry.label} (coming soon)
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <Link
      href={entry.href}
      className={classes}
      aria-current={active ? "page" : undefined}
      title={collapsed ? entry.label : undefined}
    >
      {body}
      {collapsed ? (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1F1A17] px-2.5 py-1.5 text-[13px] font-semibold text-white opacity-0 transition-opacity delay-300 group-hover:opacity-100 group-focus-within:opacity-100 min-[1024px]:block">
          {entry.label}
        </span>
      ) : null}
    </Link>
  );
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) {
    return <div aria-hidden className="mx-2 my-3 h-px bg-border" />;
  }
  return <p className="px-3 pb-2 pt-4 text-label-caps">{children}</p>;
}

export type ShellSidebarProps = {
  projects: ShellProject[];
  usage: ShellUsage;
  planId: PlanId;
  /** The project the user is currently inside, when on a project route. */
  project: ShellProject | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isAdmin?: boolean;
};

export function ShellSidebar({
  projects,
  usage,
  planId,
  project,
  collapsed,
  onToggleCollapsed,
  isAdmin = false,
}: ShellSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const plan = PLAN_BY_ID[planId] ?? PLAN_BY_ID.free;
  const badge = PLAN_BADGE[planId];
  const base = project ? `/dashboard/projects/${project.id}` : "/dashboard";

  const teamEntries: NavEntry[] = [
    { key: "websites", label: "Websites", icon: LayoutGrid, href: "/dashboard" },
    { key: "templates", label: "Templates", icon: LayoutTemplate, soon: true },
  ];
  const teamGroupEntries: NavEntry[] = [
    { key: "members", label: "Members", icon: Users, href: "/dashboard/team" },
    { key: "plan", label: "Plan and billing", icon: CreditCard, href: "/dashboard/plan" },
    { key: "invite", label: "Invite and earn", icon: Gift, soon: true },
  ];
  const youEntries: NavEntry[] = [
    { key: "account", label: "Account", icon: UserCircle, href: "/dashboard/account" },
  ];
  const projectEntries: NavEntry[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard, href: base },
    { key: "pages", label: "Pages", icon: FileText, href: `${base}/pages` },
    { key: "pictures", label: "Pictures", icon: ImageIcon, href: `${base}/images` },
    { key: "plugins", label: "Plugins", icon: Puzzle, soon: true },
    { key: "settings", label: "Settings", icon: Settings, soon: true },
  ];

  // Prefetch the project routes when the sidebar mounts, so the first click
  // on Overview, Pages or Pictures is instant (spec §7.2).
  const projectId = project?.id;
  React.useEffect(() => {
    if (!projectId) return;
    const projectBase = `/dashboard/projects/${projectId}`;
    router.prefetch(projectBase);
    router.prefetch(`${projectBase}/pages`);
    router.prefetch(`${projectBase}/images`);
  }, [projectId, router]);

  function isActive(href: string | undefined) {
    if (!href) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const websiteLimit = plan.maxWebsites;
  const websiteUsage = usage.websites;
  const websitePercent =
    websiteLimit === null ? 0 : Math.min(100, (websiteUsage / Math.max(1, websiteLimit)) * 100);

  return (
    <aside
      aria-label="Main"
      className="fixed bottom-0 left-0 top-16 z-30 hidden w-[var(--sidebar-w)] flex-col overflow-y-auto border-r border-border bg-sidebar-bg p-3 overscroll-contain min-[1024px]:flex"
      style={{ scrollbarWidth: "thin" }}
    >
      {project ? (
        <>
          <Link
            href="/dashboard"
            className={cn(
              "group relative flex h-10 items-center gap-2 rounded-input px-3 text-sm font-medium text-text-muted transition-colors hover:bg-row-hover",
              collapsed && "mx-auto w-12 justify-center px-0",
            )}
            title={collapsed ? "All websites" : undefined}
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className={cn("truncate", collapsed ? "sr-only" : undefined)}>All websites</span>
            {collapsed ? (
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1F1A17] px-2.5 py-1.5 text-[13px] font-semibold text-white opacity-0 transition-opacity delay-300 group-hover:opacity-100 min-[1024px]:block">
                All websites
              </span>
            ) : null}
          </Link>

          <ShellMenu
            label="Switch website"
            width={260}
            className={cn("mt-2", collapsed ? "flex justify-center" : undefined)}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                className={cn(
                  "flex h-14 w-full items-center gap-3 rounded-input border border-border bg-surface-muted px-3 text-left transition-colors hover:bg-row-hover",
                  collapsed && "mx-auto h-12 w-12 justify-center border-0 bg-transparent p-0",
                )}
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-base font-bold text-on-primary"
                >
                  {project.name.charAt(0).toUpperCase()}
                </span>
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-text">
                        {project.name}
                      </span>
                      <span className="flex items-center gap-1 truncate text-xs text-text-muted">
                        <Globe size={12} strokeWidth={1.75} aria-hidden />
                        {project.subdomain}.get-on.tech
                      </span>
                    </span>
                    <ChevronsUpDown
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden
                      className="shrink-0 text-text-muted"
                    />
                  </>
                ) : null}
              </button>
            )}
          >
            {projects.map((item) => {
              const active = item.id === project.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    router.push(`/dashboard/projects/${item.id}`);
                  }}
                  className="flex min-h-[52px] w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-row-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-text">
                      {item.name}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {item.subdomain}.get-on.tech
                    </span>
                  </span>
                  {active ? (
                    <Check size={16} strokeWidth={2} aria-hidden className="shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })}
            <div role="separator" className="my-1 h-px bg-border" />
            <Link
              href="/dashboard"
              role="menuitem"
              className="flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium text-text transition-colors hover:bg-row-hover"
            >
              <LayoutGrid size={18} strokeWidth={1.75} aria-hidden />
              All websites
            </Link>
          </ShellMenu>

          {!collapsed ? (
            <div className="mt-3 flex items-center gap-2 px-3">
              {project.status === "published" ? (
                <Badge variant="live" dot>
                  Live
                </Badge>
              ) : (
                <Badge variant="draft">Draft</Badge>
              )}
              <span className="text-sm text-text-muted">
                {project.status === "published" ? "Live" : "Not live yet"}
              </span>
            </div>
          ) : null}

          <nav aria-label="Website sections" className="mt-2 flex flex-col">
            {projectEntries.map((entry) => (
              <NavLink
                key={entry.key}
                entry={entry}
                active={isActive(entry.href)}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <div className="flex-1" />

          <div className="mt-4 border-t border-border pt-3">
            <Link
              href={`${base}/pages`}
              title={collapsed ? "Preview" : undefined}
              className={cn(
                "flex h-11 w-full items-center justify-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface text-[15px] font-semibold text-text transition-colors hover:bg-surface-muted",
                collapsed && "mx-auto w-12 px-0",
              )}
            >
              <Eye size={20} strokeWidth={1.75} aria-hidden />
              {collapsed ? null : "Preview"}
            </Link>
            <Link
              href={`${base}`}
              title={collapsed ? "Publish" : undefined}
              className={cn(
                "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-input bg-primary text-[15px] font-semibold text-on-primary transition-colors hover:bg-primary-hover",
                collapsed && "mx-auto w-12 px-0",
              )}
            >
              <Rocket size={20} strokeWidth={1.75} aria-hidden />
              {collapsed ? null : "Publish"}
            </Link>
          </div>
        </>
      ) : (
        <>
          <SectionLabel collapsed={collapsed}>Workspace</SectionLabel>
          <nav aria-label="Workspace" className="flex flex-col">
            {teamEntries.map((entry) => (
              <NavLink key={entry.key} entry={entry} active={isActive(entry.href)} collapsed={collapsed} />
            ))}
          </nav>

          <SectionLabel collapsed={collapsed}>Team</SectionLabel>
          <nav aria-label="Team" className="flex flex-col">
            {teamGroupEntries.map((entry) => (
              <NavLink key={entry.key} entry={entry} active={isActive(entry.href)} collapsed={collapsed} />
            ))}
          </nav>

          <SectionLabel collapsed={collapsed}>You</SectionLabel>
          <nav aria-label="You" className="flex flex-col">
            {youEntries.map((entry) => (
              <NavLink key={entry.key} entry={entry} active={isActive(entry.href)} collapsed={collapsed} />
            ))}
          </nav>

          <div className="flex-1" />

          {isAdmin ? (
            <div className="mb-2">
              <Link
                href="/admin"
                title={collapsed ? "Admin" : undefined}
                className={cn(
                  "group relative flex h-11 items-center gap-3 rounded-input px-3 text-text transition-colors hover:bg-row-hover",
                  collapsed && "mx-auto w-12 justify-center px-0",
                )}
              >
                <Shield size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
                <span className={cn("min-w-0 flex-1 truncate", collapsed ? "sr-only" : undefined)}>
                  Admin
                </span>
              </Link>
            </div>
          ) : null}

          {planId === "enterprise" ? (
            collapsed ? (
              <Link
                href="/dashboard/plan"
                title="Enterprise plan"
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-row-hover"
              >
                <CreditCard size={20} strokeWidth={1.75} aria-hidden />
              </Link>
            ) : (
              <div className="mb-2 rounded-app-card border border-border bg-surface-muted p-3.5">
                <div className="flex items-center gap-2">
                  <CircleCheck size={18} strokeWidth={1.75} aria-hidden className="text-success" />
                  <span className="text-sm font-semibold text-text">Enterprise</span>
                </div>
                <p className="mt-2 text-sm text-text-muted">You have everything</p>
              </div>
            )
          ) : collapsed ? (
            <Link
              href="/dashboard/plan"
              title={`${plan.name} plan`}
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-row-hover"
            >
              <CreditCard size={20} strokeWidth={1.75} aria-hidden />
            </Link>
          ) : (
            <div className="mb-2 rounded-app-card border border-border bg-surface-muted p-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-text">{plan.name}</span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <p className="mt-2.5 text-sm text-text-muted">
                {websiteUsage} of {websiteLimit ?? "unlimited"} websites
              </p>
              {websiteLimit !== null ? (
                <Progress
                  className="mt-1.5"
                  value={websitePercent}
                  warning={websitePercent >= 80}
                  label="Websites used"
                />
              ) : null}
              <Link
                href="/dashboard/plan"
                className="mt-3 flex h-9 w-full items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
              >
                See plans
              </Link>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "mt-2 flex h-10 w-full items-center gap-2 rounded-input px-3 text-sm font-medium text-text-muted transition-colors hover:bg-row-hover",
          collapsed && "mx-auto w-12 justify-center px-0",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden />
        ) : (
          <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden />
        )}
        {collapsed ? null : "Collapse"}
      </button>
    </aside>
  );
}
