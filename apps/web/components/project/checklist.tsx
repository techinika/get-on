"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppCard } from "@/components/app/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ChecklistProps = {
  projectId: string;
  subdomain: string;
  /** True when any of phone, email, address or logo exists in project settings. */
  detailsDone: boolean;
  customDomainAllowed: boolean;
  homepageId: string | null;
  contactEnabled: boolean;
  hasContactForm: boolean;
  /** True when the website currently has a live version. */
  published: boolean;
};

type Item = {
  id: string;
  title: string;
  description: string;
  href?: string;
  soon?: boolean;
  upgrade?: boolean;
  /** Counted towards the "{done} of {total} done" progress. */
  completable?: boolean;
  done?: boolean;
};

function subscribeToStorage() {
  return () => {};
}

function readViewed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    // Storage may be unavailable; the item simply stays incomplete.
    return false;
  }
}

export function Checklist({
  projectId,
  subdomain,
  detailsDone,
  customDomainAllowed,
  homepageId,
  contactEnabled,
  hasContactForm,
  published,
}: ChecklistProps) {
  const viewedKey = `get-on-viewed-pages:${projectId}`;
  const [userChoice, setUserChoice] = React.useState<boolean | null>(null);
  const pagesViewed = React.useSyncExternalStore(
    subscribeToStorage,
    () => readViewed(viewedKey),
    () => false,
  );

  const items: Item[] = [
    {
      id: "details",
      title: "Add your logo and business details",
      description: "Help customers recognise and reach you.",
      href: `/dashboard/projects/${projectId}/settings`,
      completable: true,
      done: detailsDone,
    },
    {
      id: "homepage",
      title: "Look at your homepage",
      description: "See what your first page looks like.",
      href: `/dashboard/projects/${projectId}/pages`,
      completable: true,
      done: pagesViewed,
    },
    {
      id: "contact-form",
      title: "Turn on your contact form",
      description: "Let customers send you messages.",
      href: `/dashboard/projects/${projectId}/plugins?enable=contact`,
      completable: true,
      done: contactEnabled,
    },
    ...(contactEnabled && homepageId
      ? [
          {
            id: "add-contact-form",
            title: "Add a contact form to a page",
            description: "Choose a ready-made one from Add a section.",
            href: `/dashboard/projects/${projectId}/pages/${homepageId}?panel=add&tab=ready`,
            completable: true,
            done: hasContactForm,
          } satisfies Item,
        ]
      : []),
    {
      id: "search",
      title: "Add a title and description for Google",
      description: "Help people find you in search results.",
      soon: true,
    },
    {
      id: "domain",
      title: "Use your own domain",
      description: `Replace ${subdomain}.get-on.tech with yourbusiness.com.`,
      href: customDomainAllowed ? undefined : "/#pricing",
      upgrade: !customDomainAllowed,
      soon: customDomainAllowed,
    },
    {
      id: "analytics",
      title: "Connect Google Analytics",
      description: "See how many people visit.",
      soon: true,
    },
    {
      id: "publish",
      title: "Publish your website",
      description: "Make it live for everyone.",
      href: `/dashboard/projects/${projectId}/publish`,
      completable: true,
      done: published,
    },
  ];

  const available = items.filter((item) => item.completable);
  const total = available.length;
  const done = available.filter((item) => item.done).length;
  const allDone = total > 0 && done >= total;
  const open = userChoice ?? !allDone;

  return (
    <AppCard className="p-6">
      <div className="flex items-center gap-2">
        <h3 className="text-section-title min-w-0 flex-1">Get your website ready</h3>
        <p className="shrink-0 text-sm text-text-muted">
          {done} of {total} done
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="setup-checklist"
          onClick={() => setUserChoice(!open)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-muted"
        >
          <span className="sr-only">{open ? "Hide checklist" : "Show checklist"}</span>
          <ChevronDown
            size={20}
            strokeWidth={1.75}
            aria-hidden
            className={cn("transition-transform duration-200", open && "rotate-180")}
          />
        </button>
      </div>

      <Progress value={total ? (done / total) * 100 : 0} label="Setup progress" className="mt-3" />

      {open ? (
        <ul id="setup-checklist" className="mt-4">
          {items.map((item) => (
            <ChecklistRow key={item.id} item={item} />
          ))}
        </ul>
      ) : null}

      {allDone && !open ? (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setUserChoice(true)}>
            Show checklist
          </Button>
        </div>
      ) : null}
    </AppCard>
  );
}

function ChecklistRow({ item }: { item: Item }) {
  const isDone = Boolean(item.done);
  const disabled = !item.href;

  const right = item.soon ? (
    <Badge variant="neutral" className="shrink-0 text-[11px] font-bold">
      Soon
    </Badge>
  ) : item.upgrade ? (
    <Badge variant="accent" className="shrink-0 text-[11px] font-bold">
      Upgrade
    </Badge>
  ) : (
    <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-text-muted" />
  );

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          isDone ? "bg-success" : "border-2 border-border-strong",
        )}
      >
        {isDone ? <Check size={14} strokeWidth={2.5} className="text-white" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-base font-semibold", isDone && "text-text-muted")}>
          {item.title}
        </span>
        <span className="mt-0.5 block text-sm text-text-muted">{item.description}</span>
        <span className="sr-only">{isDone ? "Done" : "Not done yet"}</span>
      </span>
      {right}
    </>
  );

  const rowClassName = cn(
    "flex min-h-16 items-center gap-3 rounded-input py-3 text-left transition-colors",
    disabled ? "opacity-60" : "hover:bg-surface-muted",
  );

  return (
    <li className="border-t border-border first:border-t-0">
      {item.href ? (
        <Link href={item.href} className={rowClassName}>
          {body}
        </Link>
      ) : (
        <span className={rowClassName} aria-disabled="true">
          {body}
        </span>
      )}
    </li>
  );
}
