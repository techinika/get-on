import Link from "next/link";
import { SETTINGS_GROUPS } from "@/components/settings/settings-nav";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  const base = `/dashboard/projects/${projectId}/settings`;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="font-heading text-[22px] font-bold text-text">All settings</h1>
        <p className="mt-1 text-[15px] text-text-muted">
          Choose what you want to change. On a larger screen, the same list stays on the left.
        </p>
      </div>
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.label} aria-labelledby={`settings-${group.label}`}>
          <h2 id={`settings-${group.label}`} className="text-label-caps text-text-muted">
            {group.label}
          </h2>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={`${base}/${item.href}`}
                  className={cn(
                    "flex min-h-[76px] items-start gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-surface-muted",
                    item.danger && "border-danger/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-muted",
                      item.danger && "bg-danger-soft text-danger-text",
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[15px] font-semibold text-text", item.danger && "text-danger-text")}>
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-sm text-text-muted">{item.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
