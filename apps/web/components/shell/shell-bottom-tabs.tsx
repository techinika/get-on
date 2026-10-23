"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, FileText, Image as ImageIcon, LayoutDashboard, LayoutGrid, Users } from "lucide-react";
import type { ShellProject } from "@/components/shell/types";
import { cn } from "@/lib/utils";

type Tab = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  href: string;
};

/** Mobile bottom tab bar (spec §5.6). */
export function ShellBottomTabs({ project }: { project: ShellProject | null }) {
  const pathname = usePathname();
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    function update() {
      const viewport = window.visualViewport;
      if (!viewport) return;
      // Hide while the on-screen keyboard is open.
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

  const base = project ? `/dashboard/projects/${project.id}` : "/dashboard";
  const tabs: Tab[] = project
    ? [
        { key: "overview", label: "Overview", icon: LayoutDashboard, href: base },
        { key: "pages", label: "Pages", icon: FileText, href: `${base}/pages` },
        { key: "pictures", label: "Pictures", icon: ImageIcon, href: `${base}/images` },
        { key: "websites", label: "Websites", icon: LayoutGrid, href: "/dashboard" },
      ]
    : [
        { key: "websites", label: "Websites", icon: LayoutGrid, href: "/dashboard" },
        { key: "team", label: "Team", icon: Users, href: "/dashboard/team" },
        { key: "plan", label: "Plan", icon: CreditCard, href: "/dashboard/plan" },
        { key: "account", label: "Account", icon: Users, href: "/dashboard/account" },
      ];

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] transition-transform duration-200 min-[1024px]:hidden",
        hidden ? "translate-y-full" : "translate-y-0",
      )}
    >
      <ul className="grid grid-cols-4">
        {tabs.map((tab) => {
          const active =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-primary transition-colors",
                  active ? "text-primary" : "text-text-muted",
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 mx-auto h-[3px] w-6 rounded-b-[3px] bg-primary"
                  />
                ) : null}
                <Icon size={22} strokeWidth={1.75} aria-hidden />
                <span className="text-[11px] font-semibold leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
