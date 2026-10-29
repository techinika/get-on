"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  LayoutTemplate,
  LifeBuoy,
  Mail,
  MoreVertical,
  Plus,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { AppCard } from "@/components/app/card";
import { AppEmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Sparkline, TrendBadge } from "@/components/analytics/sparkline";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { gradientFor } from "@/lib/gradient";
import { relativeTime } from "@/lib/relative-time";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";
import { cn } from "@/lib/utils";
import { ShareMenu } from "@/components/app/share-menu";

export type WebsiteSummary = {
  id: string;
  name: string;
  subdomain: string;
  status: "draft" | "published";
  updatedAt: string | null;
  unreadMessages?: number;
  siteUrl?: string | null;
  primaryHost?: string | null;
};

export type WebsitesContentProps = {
  teamName: string;
  planName: string;
  websiteCount: number;
  maxWebsites: number | null;
  memberCount: number;
  maxMembers: number | null;
  aiCredits: number;
  websites: WebsiteSummary[];
};

function usageLabel(count: number, max: number | null): string {
  return max === null ? `${count} of unlimited` : `${count} of ${max}`;
}

function usageRatio(count: number, max: number | null): number {
  if (max === null || max === 0) return 0;
  return Math.min(100, (count / max) * 100);
}

/** Websites screen (spec §6.1). */
export function WebsitesContent({
  teamName,
  planName,
  websiteCount,
  maxWebsites,
  memberCount,
  maxMembers,
  aiCredits,
  websites,
}: WebsitesContentProps) {
  const [limitOpen, setLimitOpen] = React.useState(false);
  const atLimit = maxWebsites !== null && websiteCount >= maxWebsites;

  function createWebsite(event: React.MouseEvent<HTMLAnchorElement>) {
    if (atLimit) {
      event.preventDefault();
      setLimitOpen(true);
    }
  }

  return (
    <AppPage width="wide">
      <PageHeader
        title="Websites"
        description={`Everything in ${teamName}.`}
        actions={
          <div className="flex w-full flex-col gap-2 min-[640px]:w-auto min-[640px]:flex-row">
            <Link
              href="/dashboard/new"
              onClick={createWebsite}
              className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full min-[640px]:w-auto")}
            >
              <Plus size={20} strokeWidth={1.75} aria-hidden />
              Create website
            </Link>
            <Link
              href="/dashboard/new?import=1"
              className={cn(buttonVariants({ variant: "secondary", size: "md" }), "w-full min-[640px]:w-auto")}
            >
              Import from a file
            </Link>
          </div>
        }
      />

      <AppCard className="mb-8 p-5">
        <div className="grid grid-cols-1 divide-y divide-border min-[768px]:grid-cols-3 min-[768px]:divide-x min-[768px]:divide-y-0">
          <UsageCell
            icon={<Globe size={20} strokeWidth={1.75} aria-hidden />}
            label="Websites"
            value={usageLabel(websiteCount, maxWebsites)}
            ratio={usageRatio(websiteCount, maxWebsites)}
          />
          <UsageCell
            icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
            label="Team members"
            value={usageLabel(memberCount, maxMembers)}
            ratio={usageRatio(memberCount, maxMembers)}
            className="min-[768px]:pl-6"
          />
          <UsageCell
            icon={<Sparkles size={20} strokeWidth={1.75} aria-hidden />}
            label="AI credits left"
            value={`${aiCredits}`}
            ratio={0}
            href="/dashboard/ai"
            className="min-[768px]:pl-6"
          />
        </div>
      </AppCard>

      <Section
        title="Your websites"
        action={
          <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-sm font-semibold text-text-muted">
            {websites.length}
          </span>
        }
      >
        {websites.length === 0 ? (
          <AppEmptyState
            icon={<LayoutTemplate size={48} strokeWidth={1.75} aria-hidden />}
            title="Let us get your business online"
            description="It takes about 5 minutes. We will ask a few simple questions and set everything up for you."
            action={
              <Link
                href="/dashboard/new"
                onClick={createWebsite}
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                Create your first website
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {websites.map((website) => (
              <WebsiteCard key={website.id} website={website} />
            ))}
          </div>
        )}
      </Section>

      <AppCard className="flex flex-col gap-4 p-5 min-[768px]:flex-row min-[768px]:items-center">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input bg-info-soft text-info-text"
        >
          <LifeBuoy size={24} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-card-title text-text">Not sure where to start?</p>
          <p className="mt-1 text-[15px] text-text-muted">
            Request a demo and we will walk you through it, or message us any time.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/request-demo"
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            Request a demo
          </Link>
          <Button variant="ghost" size="md" type="button" onClick={() => window.dispatchEvent(new Event("get-on:help"))}>
            Open help
          </Button>
        </div>
      </AppCard>

      <Dialog
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        title={`Your ${planName} plan includes ${maxWebsites ?? 1} website${maxWebsites === 1 ? "" : "s"}`}
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft">
            <TriangleAlert size={24} strokeWidth={1.75} aria-hidden className="text-warning-text" />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setLimitOpen(false)}>
              Close
            </Button>
            <Link
              href="/dashboard/plan"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              See plans
            </Link>
          </>
        }
      >
        <p className="text-base leading-6 text-text-muted">
          To add another website, you will need a bigger plan.
        </p>
      </Dialog>
    </AppPage>
  );
}

function UsageCell({
  icon,
  label,
  value,
  ratio,
  href,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ratio: number;
  href?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 py-4 first:pt-0 last:pb-0 min-[768px]:px-6 min-[768px]:first:pl-0", className)}>
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-accent-soft text-accent-text"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-muted">
          {href ? (
            <Link href={href} className="hover:text-text hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
        </p>
        <p className="text-stat-number text-text">{value}</p>
        {ratio > 0 ? (
          <Progress
            value={ratio}
            warning={ratio >= 80}
            label={`${label} usage`}
            className="mt-2"
          />
        ) : null}
      </div>
    </div>
  );
}

function WebsiteCard({ website }: { website: WebsiteSummary }) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const deleteInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const href = `/dashboard/projects/${website.id}`;

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${website.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(friendlyError(body.error), "error");
        return;
      }
      toast(`${website.name} was deleted.`, "success");
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast(friendlyError("NETWORK_ERROR"), "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <AppCard interactive className="relative flex flex-col">
        <div className="relative aspect-[16/10] overflow-hidden">
          <div aria-hidden className="absolute inset-0" style={{ background: gradientFor(website.id) }} />
          <div className="absolute inset-3 overflow-hidden rounded-input bg-white/90">
            <div className="flex h-5 items-center gap-1 px-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
            </div>
            <div className="flex h-[calc(100%-20px)] items-center justify-center">
              <span className="font-heading text-[32px] font-bold text-[#1F1A17]">
                {website.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="absolute left-3 top-3">
            {website.status === "published" ? (
              <Badge variant="live" dot>
                Live
              </Badge>
            ) : (
              <Badge variant="draft">Draft</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <Link href={href} className="absolute inset-0 z-0" aria-label={website.name}>
            <span className="sr-only">{website.name}</span>
          </Link>
          <h2 className="truncate text-card-title text-text">{website.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
            <Globe size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="truncate">
              {website.primaryHost ?? `${website.subdomain}.get-on.tech`}
            </span>
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            {(website.unreadMessages ?? 0) > 0 ? (
              <Link
                href={`${href}/messages`}
                className="relative z-10 flex h-6 items-center gap-1 rounded-pill bg-accent-soft px-2 text-xs font-bold text-accent-text hover:underline"
              >
                <Mail size={12} strokeWidth={2} aria-hidden />
                {website.unreadMessages} new
              </Link>
            ) : (
              <span className="truncate text-xs text-text-muted">
                Edited {relativeTime(website.updatedAt)}
              </span>
            )}
            {/* Growth sparkline and trend badge */}
            <div className="mt-3 flex items-baseline gap-2">
              <Sparkline projectId={website.id} sparklineDays={30} />
              <TrendBadge projectId={website.id} />
            </div>
            <div className="relative z-10">
              <ShareMenu url={website.primaryHost ? primaryAddress(readPublishConfig(), website.subdomain, website.primaryHost) : `https://${website.subdomain}.get-on.tech`} label={website.name} />
              <button
                type="button"
                aria-label={`More actions for ${website.name}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-row-hover"
              >
                <MoreVertical size={20} strokeWidth={1.75} aria-hidden />
              </button>
              {menuOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    aria-hidden
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    aria-label={`Actions for ${website.name}`}
                    className="absolute right-0 top-11 z-30 w-[200px] rounded-info border border-border bg-surface p-1.5 shadow-raised"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push(href);
                      }}
                      className="flex h-11 w-full items-center rounded-[10px] px-3 text-left text-[15px] font-medium text-text transition-colors hover:bg-row-hover"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push(`${href}/pages`);
                      }}
                      className="flex h-11 w-full items-center rounded-[10px] px-3 text-left text-[15px] font-medium text-text transition-colors hover:bg-row-hover"
                    >
                      Preview
                    </button>
                    <div role="separator" className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setDeleteOpen(true);
                      }}
                      className="flex h-11 w-full items-center rounded-[10px] px-3 text-left text-[15px] font-medium text-danger-text transition-colors hover:bg-row-hover"
                    >
                      Delete website
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </AppCard>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${website.name}?`}
        initialFocusRef={deleteInputRef}
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
            <TriangleAlert size={24} strokeWidth={1.75} aria-hidden className="text-danger" />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={deleting}
              disabled={confirmText !== website.name}
              onClick={handleDelete}
            >
              Delete website
            </Button>
          </>
        }
      >
        <p className="text-base leading-6 text-text-muted">
          Your website will be taken down. You can ask us to bring it back within 14 days.
        </p>
        <div className="mt-4">
          <Label htmlFor="delete-confirm">Type {website.name} to confirm</Label>
          <Input
            id="delete-confirm"
            ref={deleteInputRef}
            className="mt-1.5"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
          />
        </div>
      </Dialog>
    </>
  );
}
