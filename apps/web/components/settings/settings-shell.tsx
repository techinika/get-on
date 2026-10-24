"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { SETTINGS_GROUPS as groups } from "./settings-nav";

export function getProjectId(pathname: string) {
  const parts = pathname.split("/");
  const idx = parts.indexOf("projects");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  return null;
}

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const projectId = getProjectId(pathname);
  const base = projectId ? `/dashboard/projects/${projectId}/settings` : "/dashboard";

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: "Project", href: projectId ? `/dashboard/projects/${projectId}` : "/dashboard" },
          { label: "Settings" },
        ]}
        title="Settings"
        description="Details and options for your website."
      />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 flex flex-col" aria-label="Settings">
            {groups.map((group, groupIdx) => (
              <div key={group.label} className={cn(groupIdx === 0 && "pt-0", groupIdx > 0 && "mt-4")}>
                <div className="px-3 pb-2 text-label-caps text-text-muted">{group.label}</div>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const href = `${base}/${item.href}`;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text",
                          active && "bg-primary-soft font-semibold text-primary",
                          item.danger && "text-danger-text hover:text-danger-text",
                        )}
                      >
                        <Icon size={18} strokeWidth={1.75} aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
          {pathname !== base ? (
            <Link
              href={base}
              className="mb-4 inline-flex h-11 items-center gap-1 text-[15px] font-semibold text-primary hover:underline lg:hidden"
            >
              All settings
            </Link>
          ) : null}
          {children}
        </div>
      </div>
    </AppPage>
  );
}
