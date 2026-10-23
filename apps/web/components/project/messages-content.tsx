"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { InfoBox } from "@/components/app/info-box";
import { AppEmptyState } from "@/components/app/empty-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { mailtoHref, replyBody, telHref, whatsappHref } from "@/lib/contact/links";
import { cn } from "@/lib/utils";
import {
  deleteMessages,
  updateMessages,
} from "@/app/dashboard/(shell)/projects/[projectId]/plugins/actions";

export type MessageItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "new" | "read" | "archived" | "spam";
  replied: boolean;
  page_path: string | null;
  created_at: string;
};

type Tab = "all" | "new" | "archived" | "spam";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "archived", label: "Archived" },
  { id: "spam", label: "Spam" },
];

function shortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fullDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayName(message: MessageItem): string {
  return message.name.trim() || "Someone (no name)";
}

function pageTitle(path: string | null, pages: Record<string, string>): string {
  if (!path) return "";
  return pages[path] ?? path;
}

export function MessagesContent({
  projectId,
  projectName,
  teamName,
  initialMessages,
  pages,
  active,
  everPublished,
  limitHit,
}: {
  projectId: string;
  projectName: string;
  teamName: string;
  initialMessages: MessageItem[];
  pages: Record<string, string>;
  active: boolean;
  everPublished: boolean;
  limitHit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [messages, setMessages] = React.useState(initialMessages);
  const [tab, setTab] = React.useState<Tab>("all");
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialMessages[0]?.id ?? null);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(true);
  const initKeyRef = React.useRef<string>(JSON.stringify(initialMessages.map((m) => m.id)));

  React.useEffect(() => {
    const key = JSON.stringify(initialMessages.map((m) => m.id));
    if (key === initKeyRef.current) return;
    initKeyRef.current = key;
    setMessages(initialMessages);
    setSelectedId((current) => (current && initialMessages.some((m) => m.id === current) ? current : initialMessages[0]?.id ?? null));
    setChecked(new Set());
  }, [initialMessages]);

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") router.refresh();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [router]);

  const readTimers = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    const timers = readTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function markReadAfterDelay(id: string) {
    if (readTimers.current[id]) return;
    readTimers.current[id] = window.setTimeout(async () => {
      delete readTimers.current[id];
      setMessages((list) =>
        list.map((item) => (item.id === id && item.status === "new" ? { ...item, status: "read" } : item)),
      );
      const result = await updateMessages(projectId, [id], { status: "read" });
      if (!result.ok) toast(friendlyError(result.error), "error");
      router.refresh();
    }, 1500);
  }

  function openMessage(message: MessageItem) {
    setSelectedId(message.id);
    if (message.status === "new") markReadAfterDelay(message.id);
    if (!isDesktop) router.push(`/dashboard/projects/${projectId}/messages/${message.id}`);
  }

  const visible = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return messages.filter((message) => {
      if (tab === "new" && message.status !== "new") return false;
      if (tab === "archived" && message.status !== "archived") return false;
      if (tab === "spam" && message.status !== "spam") return false;
      if (tab === "all" && message.status === "archived") return false;
      if (!q) return true;
      const haystack = [message.name, message.email, message.phone ?? "", message.message]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [messages, tab, deferredQuery]);

  const selected = messages.find((message) => message.id === selectedId) ?? visible[0] ?? null;

  const counts = {
    all: messages.filter((m) => m.status !== "archived").length,
    new: messages.filter((m) => m.status === "new").length,
    archived: messages.filter((m) => m.status === "archived").length,
    spam: messages.filter((m) => m.status === "spam").length,
  };

  async function patch(ids: string[], values: { status?: MessageItem["status"]; replied?: boolean }) {
    setBusy(true);
    const result = await updateMessages(projectId, ids, values);
    setBusy(false);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    setMessages((list) =>
      list.map((message) => (ids.includes(message.id) ? { ...message, ...values } : message)),
    );
    setChecked(new Set());
    router.refresh();
  }

  async function remove(ids: string[]) {
    setBusy(true);
    const result = await deleteMessages(projectId, ids);
    setBusy(false);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    setMessages((list) => list.filter((message) => !ids.includes(message.id)));
    setChecked(new Set());
    setDeleteIds(null);
    toast(ids.length === 1 ? "Message deleted." : "Messages deleted.", "success");
    router.refresh();
  }

  function toggleChecked(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!active) {
    return (
      <AppPage width="wide">
        <MessagesHeader projectId={projectId} projectName={projectName} teamName={teamName} />
        <InfoBox variant="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>The Contact form is off.</span>
            <Link
              href={`/dashboard/projects/${projectId}/plugins?enable=contact`}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              Turn on
            </Link>
          </div>
        </InfoBox>
      </AppPage>
    );
  }

  if (messages.length === 0) {
    return (
      <AppPage width="wide">
        <MessagesHeader projectId={projectId} projectName={projectName} teamName={teamName} />
        {!everPublished ? (
          <InfoBox variant="info" className="mb-6">
            Publish your website so visitors can reach you.
          </InfoBox>
        ) : null}
        <AppEmptyState
          icon={<Inbox size={56} strokeWidth={1.5} aria-hidden />}
          title="No messages yet"
          description="When someone fills in the contact form on your website, you will see their message here and get an email."
          action={
            <Link
              href={`/dashboard/projects/${projectId}/pages`}
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              Add a form to a page
            </Link>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage width="wide">
      <MessagesHeader projectId={projectId} projectName={projectName} teamName={teamName} />

      {limitHit ? (
        <InfoBox variant="warning" className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Your website reached today&apos;s message limit. Visitors were asked to contact you
              another way.
            </span>
            <Link href="/dashboard/plan" className="text-sm font-semibold underline">
              See plans
            </Link>
          </div>
        </InfoBox>
      ) : null}

      {checked.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <p className="mr-auto text-[15px] font-semibold text-text">{checked.size} selected</p>
          <Button variant="secondary" size="sm" onClick={() => void patch([...checked], { status: "archived" })} disabled={busy}>
            <Archive size={16} strokeWidth={1.75} aria-hidden />
            Archive
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void patch([...checked], { status: "read" })} disabled={busy}>
            Mark as read
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void patch([...checked], { status: "spam" })} disabled={busy}>
            Mark as spam
          </Button>
          <Button variant="danger-outline" size="sm" onClick={() => setDeleteIds([...checked])} disabled={busy}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setChecked(new Set())}>
            Clear
          </Button>
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-3 border-b border-border min-[768px]:flex-row min-[768px]:items-center">
          <div role="tablist" aria-label="Message filters" className="flex flex-1 gap-1 overflow-x-auto">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-[15px] font-semibold transition-colors",
                  tab === item.id ? "text-primary" : "text-text-muted hover:text-text",
                )}
              >
                {item.label}
                {item.id !== "all" ? (
                  <span className="text-[13px] font-normal text-text-muted">{counts[item.id]}</span>
                ) : null}
                {tab === item.id ? (
                  <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-primary" />
                ) : null}
              </button>
            ))}
          </div>
          <div className="relative pb-2 min-[768px]:w-64 min-[768px]:pb-0">
            <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search messages"
              aria-label="Search messages"
              className="h-11 pl-10"
            />
          </div>
        </div>
      )}

      <AppCard className="overflow-hidden p-0 min-[1024px]:grid min-[1024px]:grid-cols-[380px_minmax(0,1fr)]">
        <div
          className="min-[1024px]:max-h-[clamp(520px,calc(100dvh-300px),760px)] min-[1024px]:overflow-y-auto min-[1024px]:border-r min-[1024px]:border-border"
          aria-label="Messages"
        >
          {visible.length === 0 ? (
            <p className="py-12 text-center text-[15px] text-text-muted">Nothing here.</p>
          ) : (
            <ul>
              {visible.map((message) => {
                const activeRow = selected?.id === message.id;
                return (
                  <li key={message.id} className="border-b border-border last:border-b-0">
                    <div
                      className={cn(
                        "group relative flex min-h-20 w-full gap-2 px-4 py-3.5 text-left transition-colors",
                        activeRow ? "bg-primary-soft" : "hover:bg-row-hover",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`Select ${displayName(message)}`}
                        onClick={() => toggleChecked(message.id)}
                        className={cn(
                          "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border-[1.5px] border-border-strong bg-surface",
                          checked.has(message.id) ? "border-primary bg-primary text-on-primary" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                        )}
                      >
                        {checked.has(message.id) ? <span className="text-xs">✓</span> : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => openMessage(message)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-baseline gap-2">
                          <span
                            aria-hidden
                            className={cn(
                              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                              message.status === "new" ? "bg-primary" : "bg-transparent",
                            )}
                          />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-[15px]",
                              message.status === "new" ? "font-bold text-text" : "font-medium text-text",
                            )}
                          >
                            {displayName(message)}
                          </span>
                          <span className="shrink-0 text-xs text-text-muted">{shortTime(message.created_at)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block pl-4 text-sm text-text-muted">
                          {message.message}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
                          {message.page_path ? (
                            <Badge variant="neutral" className="h-5 text-[12px]">
                              From {pageTitle(message.page_path, pages)}
                            </Badge>
                          ) : null}
                          {message.status === "spam" ? (
                            <Badge variant="danger" className="h-5 text-[12px]">
                              Spam
                            </Badge>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden min-[1024px]:block">
          {selected ? (
            <MessageDetailView
              projectId={projectId}
              projectName={projectName}
              message={selected}
              pageLabel={pageTitle(selected.page_path, pages)}
              busy={busy}
              onPatch={(values) => void patch([selected.id], values)}
              onDelete={() => setDeleteIds([selected.id])}
            />
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center p-8 text-center">
              <Inbox size={40} strokeWidth={1.5} aria-hidden className="text-text-muted" />
              <p className="mt-3 text-base text-text-muted">Choose a message to read it.</p>
            </div>
          )}
        </div>
      </AppCard>

      <ConfirmDialog
        open={Boolean(deleteIds)}
        onClose={() => (busy ? undefined : setDeleteIds(null))}
        title={deleteIds?.length === 1 ? "Delete this message?" : "Delete these messages?"}
        description="It cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={() => deleteIds && void remove(deleteIds)}
      />
    </AppPage>
  );
}

function MessagesHeader({
  projectId,
  projectName,
  teamName,
}: {
  projectId: string;
  projectName: string;
  teamName: string;
}) {
  return (
    <PageHeader
      breadcrumbs={[
        { label: teamName, href: "/dashboard" },
        { label: projectName, href: `/dashboard/projects/${projectId}` },
        { label: "Messages" },
      ]}
      title="Messages"
      description="People who wrote to you from your website."
      actions={
        <>
          <a
            href={`/dashboard/projects/${projectId}/messages/export`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            <Download size={20} strokeWidth={1.75} aria-hidden />
            Export
          </a>
          <Link
            href={`/dashboard/projects/${projectId}/plugins/contact`}
            className={buttonVariants({ variant: "ghost", size: "md" })}
          >
            <Settings size={20} strokeWidth={1.75} aria-hidden />
            Settings
          </Link>
        </>
      }
    />
  );
}

export function MessageDetailView({
  projectId,
  projectName,
  message,
  pageLabel,
  busy,
  onPatch,
  onDelete,
  backHref,
  previous,
  next,
}: {
  projectId: string;
  projectName: string;
  message: MessageItem;
  pageLabel: string;
  busy?: boolean;
  onPatch: (values: { status?: MessageItem["status"]; replied?: boolean }) => void;
  onDelete: () => void;
  backHref?: string;
  previous?: MessageItem | null;
  next?: MessageItem | null;
}) {
  const mailto = mailtoHref(message.email, `Re: your message to ${projectName}`, replyBody(message.message));
  const call = telHref(message.phone);
  const whatsapp = whatsappHref(message.phone, `Hello ${message.name || "there"},`);
  const archived = message.status === "archived";
  const spam = message.status === "spam";

  return (
    <div className="flex min-h-[420px] flex-col">
      {backHref ? (
        <div className="px-4 pt-3">
          <Link href={backHref} className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-primary">
            <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
            Messages
          </Link>
        </div>
      ) : null}
      <div className="border-b border-border px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-bold text-text">{displayName(message)}</h2>
            <a href={`mailto:${message.email}`} className="mt-1 block break-all text-[15px] text-primary hover:underline">
              {message.email}
            </a>
            {call ? (
              <a href={call} className="block text-[15px] text-text hover:underline">
                {message.phone}
              </a>
            ) : null}
            <p className="mt-2 text-[13px] text-text-muted">
              Received {fullDate(message.created_at)}
              {pageLabel ? ` · From ${pageLabel}` : ""}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={archived ? "Move to inbox" : "Archive"}
              onClick={() => onPatch({ status: archived ? "read" : "archived" })}
              disabled={busy}
              className="flex h-11 w-11 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted hover:text-text"
            >
              {archived ? <ArchiveRestore size={20} strokeWidth={1.75} aria-hidden /> : <Archive size={20} strokeWidth={1.75} aria-hidden />}
            </button>
            <button
              type="button"
              aria-label={spam ? "Not spam" : "Spam"}
              onClick={() => onPatch({ status: spam ? "read" : "spam" })}
              disabled={busy}
              className="flex h-11 w-11 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted hover:text-text"
            >
              {spam ? <ShieldCheck size={20} strokeWidth={1.75} aria-hidden /> : <ShieldAlert size={20} strokeWidth={1.75} aria-hidden />}
            </button>
            <button
              type="button"
              aria-label="Delete"
              onClick={onDelete}
              disabled={busy}
              className="flex h-11 w-11 items-center justify-center rounded-input text-text-muted hover:bg-danger-soft hover:text-danger-text"
            >
              <Trash2 size={20} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {mailto ? (
            <a href={mailto} className={buttonVariants({ variant: "primary", size: "md" })}>
              <Mail size={18} strokeWidth={1.75} aria-hidden />
              Reply by email
            </a>
          ) : null}
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "md" })}>
              <MessageCircle size={18} strokeWidth={1.75} aria-hidden className="text-[#1FA855]" />
              Reply on WhatsApp
            </a>
          ) : null}
          {call ? (
            <a href={call} className={buttonVariants({ variant: "secondary", size: "md" })}>
              <Phone size={18} strokeWidth={1.75} aria-hidden />
              Call
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => onPatch({ replied: !message.replied })}
            aria-pressed={message.replied}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-pill border-[1.5px] px-3.5 text-sm font-semibold",
              message.replied
                ? "border-success bg-success-soft text-success-text"
                : "border-border-strong bg-surface text-text hover:bg-surface-muted",
            )}
          >
            {message.replied ? <span aria-hidden>✓</span> : null}
            Replied
          </button>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="rounded-app-card bg-surface-muted p-5">
          <p className="whitespace-pre-wrap break-words text-base leading-[1.7] text-text">
            {message.message}
          </p>
        </div>
        {previous || next ? (
          <div className="mt-6 flex items-center justify-between gap-2">
            {previous ? (
              <Link
                href={`/dashboard/projects/${projectId}/messages/${previous.id}`}
                className={buttonVariants({ variant: "ghost", size: "md" })}
              >
                <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
                Previous
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/dashboard/projects/${projectId}/messages/${next.id}`}
                className={buttonVariants({ variant: "ghost", size: "md" })}
              >
                Next
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
