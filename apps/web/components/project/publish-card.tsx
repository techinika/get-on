"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Rocket,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PublishDialog } from "@/components/project/publish-dialog";
import { friendlyError } from "@/lib/errors";
import { relativeTime } from "@/lib/relative-time";
import { displayAddress, siteStateCopy, type SiteState } from "@/lib/publishing/status";
import { cn } from "@/lib/utils";

export type PublishCardProps = {
  projectId: string;
  name: string;
  address: string;
  state: SiteState;
  hasLiveVersion: boolean;
  pagesCount: number;
  homepageReady: boolean;
  detailsReady: boolean;
  lastPublishedAt: string | null;
  className?: string;
};

export function PublishCard({
  projectId,
  name,
  address,
  state,
  hasLiveVersion,
  pagesCount,
  homepageReady,
  detailsReady,
  lastPublishedAt,
  className,
}: PublishCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [offlineOpen, setOfflineOpen] = React.useState(false);
  const [takingOffline, setTakingOffline] = React.useState(false);

  const copy = siteStateCopy(state);
  const busy = state === "review" || state === "suspended";
  const publishLabel =
    state === "changes"
      ? "Publish changes"
      : state === "offline"
        ? "Publish again"
        : "Publish website";

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      toast("Address copied.", "success");
    } catch {
      toast("We could not copy that. Please copy it by hand.", "error");
    }
  }

  async function takeOffline() {
    setTakingOffline(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/unpublish`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok || body?.error) {
        toast(friendlyError(body?.error), "error");
        return;
      }
      setOfflineOpen(false);
      toast("Your website is now offline.", "success");
      router.refresh();
    } catch {
      toast(friendlyError("NETWORK_ERROR"), "error");
    } finally {
      setTakingOffline(false);
    }
  }

  return (
    <div className={cn("app-card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-label-caps">Publishing</p>
          <div className="mt-2">
            <Badge variant={copy.badge} dot={state === "live" || state === "changes"}>
              {copy.label}
            </Badge>
          </div>
        </div>
        <Menu
          label="Publishing actions"
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label="More publishing actions"
              className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-muted"
            >
              <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        >
          {hasLiveVersion ? (
            <MenuItem onClick={() => window.open(address, "_blank", "noreferrer")}>
              <ExternalLink size={18} strokeWidth={1.75} aria-hidden />
              Open website
            </MenuItem>
          ) : null}
          <MenuItem onClick={() => void copyAddress()}>
            <Copy size={18} strokeWidth={1.75} aria-hidden />
            Copy address
          </MenuItem>
          {!busy && (hasLiveVersion || state === "draft") ? (
            <MenuItem onClick={() => setDialogOpen(true)}>
              <RefreshCw size={18} strokeWidth={1.75} aria-hidden />
              {hasLiveVersion ? "Publish again" : "Publish website"}
            </MenuItem>
          ) : null}
          {hasLiveVersion && !busy ? (
            <>
              <MenuSeparator />
              <MenuItem destructive onClick={() => setOfflineOpen(true)}>
                <WifiOff size={18} strokeWidth={1.75} aria-hidden />
                Take offline
              </MenuItem>
            </>
          ) : null}
          {hasLiveVersion ? (
            <>
              <MenuSeparator />
              <MenuItem
                onClick={() => router.push(`/dashboard/projects/${projectId}/publish`)}
              >
                Version history
              </MenuItem>
            </>
          ) : null}
        </Menu>
      </div>

      <p className="mt-2 text-sm leading-5 text-text-muted">{copy.sentence}</p>

      <p className="mt-3 break-all text-[15px] font-semibold text-primary">
        {displayAddress(address)}
      </p>

      {lastPublishedAt ? (
        <p className="mt-1 text-sm text-text-muted">
          Last published {relativeTime(lastPublishedAt)}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {busy ? (
          <Button variant="secondary" size="md" type="button" disabled>
            {state === "review" ? "Under review" : "Suspended"}
          </Button>
        ) : state === "live" ? (
          <a
            href={address}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-input bg-primary px-5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover"
          >
            <ExternalLink size={18} strokeWidth={1.75} aria-hidden />
            Open website
          </a>
        ) : (
          <Button variant="primary" size="md" type="button" onClick={() => setDialogOpen(true)}>
            <Rocket size={18} strokeWidth={1.75} aria-hidden />
            {publishLabel}
          </Button>
        )}

        {hasLiveVersion ? (
          <Link
            href={`/dashboard/projects/${projectId}/publish`}
            className="text-center text-sm font-semibold text-primary hover:underline"
          >
            Version history
          </Link>
        ) : null}
      </div>

      {dialogOpen ? (
        <PublishDialog
          open
          onClose={() => setDialogOpen(false)}
          projectId={projectId}
          name={name}
          address={address}
          hasLiveVersion={hasLiveVersion}
          pagesCount={pagesCount}
          homepageReady={homepageReady}
          detailsReady={detailsReady}
          blockedReason={state === "review" ? "review" : state === "suspended" ? "suspended" : null}
          onPublished={() => router.refresh()}
        />
      ) : null}

      <ConfirmDialog
        open={offlineOpen}
        onClose={() => (takingOffline ? undefined : setOfflineOpen(false))}
        title="Take your website offline?"
        description="Visitors will see a short message instead of your website. Your pages and published versions stay saved, and you can publish again at any time."
        confirmLabel="Take offline"
        destructive
        loading={takingOffline}
        onConfirm={() => void takeOffline()}
      />
    </div>
  );
}
