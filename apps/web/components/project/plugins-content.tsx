"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Info,
  KeyRound,
  Languages,
  Lock,
  Mail,
  MailPlus,
  Moon,
  MoreVertical,
  Newspaper,
  Puzzle,
} from "lucide-react";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { AppPage } from "@/components/app/app-page";
import { InfoBox } from "@/components/app/info-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { disablePlugin, enablePlugin } from "@/app/dashboard/(shell)/projects/[projectId]/plugins/actions";

export type PluginCardData = {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  status: "available" | "planned";
  state: "active" | "disabled" | "absent";
  locked: boolean;
  mainRoute?: string;
  settingsRoute?: string;
};

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>> = {
  mail: Mail,
  "mail-plus": MailPlus,
  newspaper: Newspaper,
  languages: Languages,
  moon: Moon,
  "key-round": KeyRound,
};

const CONTACT_ROWS = [
  "A Messages page appears in your menu.",
  "You can add contact forms to your pages.",
  "We email you when someone writes to you.",
];

function statusOf(plugin: PluginCardData) {
  if (plugin.status === "planned") return { label: "Coming soon", variant: "neutral" as const };
  if (plugin.locked) return { label: "Locked", variant: "draft" as const };
  if (plugin.state === "active") return { label: "On", variant: "live" as const };
  return { label: "Off", variant: "neutral" as const };
}

export function PluginsContent({
  projectId,
  projectName,
  teamName,
  plugins,
  used,
  limit,
  planName,
  initialEnable,
}: {
  projectId: string;
  projectName: string;
  teamName: string;
  plugins: PluginCardData[];
  used: number;
  limit: number | null;
  planName: string;
  initialEnable?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [enableTarget, setEnableTarget] = React.useState<PluginCardData | null>(
    plugins.find((plugin) => plugin.id === initialEnable) ?? null,
  );
  const [disableTarget, setDisableTarget] = React.useState<PluginCardData | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState<string | null>(null);
  const atLimit = limit !== null && used >= limit;
  const showLimitWarning = atLimit && plugins.some((p) => p.status === "available" && p.state !== "active" && !p.locked);

  async function turnOn(plugin: PluginCardData) {
    setPending(plugin.id);
    const result = await enablePlugin(projectId, plugin.id);
    setPending(null);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    setEnableTarget(null);
    toast(`${plugin.name} is on.`, "success");
    setHighlight(plugin.id);
    window.setTimeout(() => setHighlight(null), 250);
    router.refresh();
  }

  async function turnOff(plugin: PluginCardData) {
    setPending(plugin.id);
    const result = await disablePlugin(projectId, plugin.id);
    setPending(null);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    setDisableTarget(null);
    toast(`${plugin.name} is off.`, "success");
    router.refresh();
  }

  return (
    <AppPage>
      <PageHeader
        breadcrumbs={[
          { label: teamName, href: "/dashboard" },
          { label: projectName, href: `/dashboard/projects/${projectId}` },
          { label: "Plugins" },
        ]}
        title="Plugins"
        description={`Add extra features to ${projectName}. Turn them on when you need them.`}
      />

      <AppCard className="p-5">
        <p className="text-[15px] font-semibold text-text">
          {used} of {limit ?? "unlimited"} plugins on this website
        </p>
        {limit !== null ? (
          <Progress
            className="mt-2"
            value={Math.min(100, (used / Math.max(1, limit)) * 100)}
            label="Plugins used"
          />
        ) : null}
        {planName === "Free" ? (
          <p className="mt-2 text-sm text-text-muted">Your Free plan includes the Contact form.</p>
        ) : null}
      </AppCard>

      {showLimitWarning ? (
        <InfoBox variant="warning" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Your plan includes {limit} plugin{limit === 1 ? "" : "s"}. Turn one off or upgrade to
              add another.
            </span>
            <Link
              href="/dashboard/plan"
              className="inline-flex h-9 items-center rounded-input border border-current px-3 text-sm font-semibold"
            >
              See plans
            </Link>
          </div>
        </InfoBox>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:gap-5">
        {plugins.map((plugin) => {
          const Icon = ICONS[plugin.icon] ?? Puzzle;
          const status = statusOf(plugin);
          const busy = pending === plugin.id;
          return (
            <AppCard
              key={plugin.id}
              className={cn(
                "flex flex-col p-5 transition-colors",
                highlight === plugin.id && "border-primary bg-success-soft",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent-text">
                  <Icon size={24} strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-text">{plugin.name}</h2>
                    <Badge variant={status.variant} className="shrink-0">
                      {plugin.locked ? <Lock size={12} strokeWidth={2} aria-hidden /> : null}
                      {status.label}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-[1.5] text-text-muted">
                    {plugin.tagline}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                {plugin.status === "planned" ? (
                  <Button variant="secondary" size="md" disabled>
                    Coming soon
                  </Button>
                ) : plugin.locked ? (
                  <>
                    <Link
                      href="/dashboard/plan"
                      className="inline-flex h-11 items-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
                    >
                      Upgrade
                    </Link>
                    <span className="text-[13px] text-text-muted">
                      Your plan allows {limit ?? "unlimited"} plugin{limit === 1 ? "" : "s"}.
                    </span>
                  </>
                ) : plugin.state === "active" ? (
                  <>
                    <Link
                      href={`/dashboard/projects/${projectId}/${plugin.mainRoute ?? ""}`}
                      className="inline-flex h-11 items-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
                    >
                      Open
                    </Link>
                    {plugin.settingsRoute ? (
                      <Link
                        href={`/dashboard/projects/${projectId}/${plugin.settingsRoute}`}
                        className="inline-flex h-11 items-center rounded-input px-5 text-base font-semibold text-text hover:bg-surface-muted"
                      >
                        Settings
                      </Link>
                    ) : null}
                    <Menu
                      label={`${plugin.name} actions`}
                      trigger={(props) => (
                        <button
                          {...props}
                          type="button"
                          aria-label={`${plugin.name} actions`}
                          className="ml-auto flex h-11 w-11 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
                        >
                          <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
                        </button>
                      )}
                    >
                      <MenuItem destructive onClick={() => setDisableTarget(plugin)}>
                        Turn off
                      </MenuItem>
                    </Menu>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={atLimit}
                    title={
                      atLimit
                        ? `Your plan includes ${limit} plugin${limit === 1 ? "" : "s"}. Turn one off or upgrade.`
                        : undefined
                    }
                    loading={busy}
                    loadingLabel="Turning on..."
                    onClick={() => setEnableTarget(plugin)}
                  >
                    Turn on
                  </Button>
                )}
              </div>
            </AppCard>
          );
        })}
      </div>

      <Dialog
        open={Boolean(enableTarget)}
        onClose={() => (pending ? undefined : setEnableTarget(null))}
        title={`Turn on ${enableTarget?.name ?? "this plugin"}?`}
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent-soft text-accent-text">
            <Info size={24} strokeWidth={1.75} aria-hidden />
          </span>
        }
        dismissible={!pending}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setEnableTarget(null)} disabled={Boolean(pending)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={Boolean(pending)}
              loadingLabel="Turning on..."
              onClick={() => enableTarget && void turnOn(enableTarget)}
            >
              Turn on
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-3">
          {(enableTarget?.id === "contact" ? CONTACT_ROWS : ["This feature appears in your project menu."]).map((row) => (
            <li key={row} className="flex gap-2.5 text-[15px] text-text">
              <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-success" />
              <span>{row}</span>
            </li>
          ))}
        </ul>
        {limit !== null ? (
          <p className="mt-4 text-sm text-text-muted">
            This uses 1 of your {limit} plugins.
          </p>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(disableTarget)}
        onClose={() => (pending ? undefined : setDisableTarget(null))}
        title={`Turn off ${disableTarget?.name ?? "this plugin"}?`}
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-warning-soft text-warning-text">
            <Info size={24} strokeWidth={1.75} aria-hidden />
          </span>
        }
        dismissible={!pending}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDisableTarget(null)} disabled={Boolean(pending)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={Boolean(pending)}
              loadingLabel="Turning off..."
              onClick={() => disableTarget && void turnOff(disableTarget)}
            >
              Turn off
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-3 text-[15px] text-text">
          <li>Forms disappear from your live website the next time you publish.</li>
          <li>Your messages are kept. They come back if you turn it on again.</li>
          <li>The Messages page is hidden.</li>
        </ul>
      </Dialog>
    </AppPage>
  );
}
