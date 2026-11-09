"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUp,
  Clock,
  History,
  Loader2,
  MessageSquarePlus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { HelpContent } from "@/components/shell/help-panel";
import { CreateSiteFlow } from "@/components/agent/create-site-flow";
import type { ShellRole } from "@/components/shell/types";
import type { PlanId } from "@/lib/plans";
import { useMediaQuery } from "@/lib/use-media-query";
import { createClient } from "@/lib/supabase/client";
import {
  ASSISTANT_CHAT_CREDITS,
  ASSISTANT_DEFAULT_WIDTH,
  ASSISTANT_MAX_WIDTH,
  ASSISTANT_MIN_WIDTH,
  clampAssistantWidth,
  type AssistantTab,
} from "@/lib/agent/constants";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  credits?: number;
  createdAt?: string;
};

type Conversation = {
  id: string;
  title: string;
  projectId: string | null;
  lastMessageAt: string;
  createdAt: string;
};

export type AssistantDockProps = {
  open: boolean;
  tab: AssistantTab;
  width: number;
  enabled: boolean;
  role: ShellRole;
  planId: PlanId;
  teamId: string;
  teamName: string;
  userId: string;
  projectId: string | null;
  projectName: string;
  credits: number;
  onClose: () => void;
  onTabChange: (tab: AssistantTab) => void;
  onWidthChange: (width: number) => void;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length > 0) {
        try {
          onEvent(event, JSON.parse(dataLines.join("\n")) as Record<string, unknown>);
        } catch {
          // Ignore a malformed event and keep the stream alive.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function messageFrom(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    (row.role !== "user" && row.role !== "assistant") ||
    typeof row.content !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    credits: Number(row.credits ?? 0),
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : typeof row.created_at === "string"
          ? row.created_at
          : undefined,
  };
}

export function AssistantDock({
  open,
  tab,
  width,
  enabled,
  role,
  planId,
  teamId,
  teamName,
  userId,
  projectId,
  projectName,
  credits,
  onClose,
  onTabChange,
  onWidthChange,
  returnFocusRef,
}: AssistantDockProps) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const canUse = role === "owner" || role === "admin" || role === "editor";
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const loadedRef = React.useRef(false);
  const optimisticIdRef = React.useRef<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const sendingRef = React.useRef(false);
  const conversationIdRef = React.useRef<string | null>(null);
  const widthRef = React.useRef(width);
  React.useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState("");
  const [statusLabel, setStatusLabel] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [remoteBusy, setRemoteBusy] = React.useState(false);
  const [balance, setBalance] = React.useState(credits);
  const [createSiteOpen, setCreateSiteOpen] = React.useState(false);
  const [pendingConfirmation, setPendingConfirmation] = React.useState<{
    id: string;
    tool: string;
    summary: string;
    estimatedCredits: number;
    expiresAt: string;
  } | null>(null);
  const [editingBrief, setEditingBrief] = React.useState(false);
  const [briefForm, setBriefForm] = React.useState<{
    name: string;
    address: string;
    businessType: string;
    about: string;
    style: string;
  }>({ name: "", address: "", businessType: "", about: "", style: "" });
  const needsCredits = balance < ASSISTANT_CHAT_CREDITS;

  const draftKey = `get-on:assistant:draft:${userId}`;
  const activeKey = `get-on:assistant:conversation:${userId}`;

  React.useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      setDraft(window.localStorage.getItem(draftKey) ?? "");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [draftKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const value = draft.slice(0, 4000);
    if (value) window.localStorage.setItem(draftKey, value);
    else window.localStorage.removeItem(draftKey);
  }, [draft, draftKey]);

  const loadConversation = React.useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const response = await fetch(`/api/agent/conversations/${id}`);
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "We could not load that chat.",
          );
        }
        const rows = Array.isArray(data.messages) ? data.messages : [];
        setRemoteBusy(false);
        setConversationId(id);
        setMessages(
          rows
            .map(messageFrom)
            .filter((message): message is ChatMessage => message !== null),
        );
        if (typeof data.balance === "number") setBalance(data.balance);
        window.localStorage.setItem(activeKey, id);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "We could not load that chat.");
      } finally {
        setLoading(false);
      }
    },
    [activeKey],
  );

  React.useEffect(() => {
    if (!open || tab !== "assistant" || !enabled || !canUse) {
      loadedRef.current = false;
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/agent/conversations");
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "We could not load your chats.",
          );
        }
        if (cancelled) return;
        const list = (Array.isArray(data.conversations) ? data.conversations : [])
          .filter((item): item is Conversation => {
            return Boolean(
              item &&
                typeof item === "object" &&
                typeof (item as Record<string, unknown>).id === "string",
            );
          });
        setConversations(list);
        const saved =
          typeof window !== "undefined" ? window.localStorage.getItem(activeKey) : null;
        const next = list.find((item) => item.id === saved) ?? list[0];
        if (next) {
          await loadConversation(next.id);
        } else {
          setConversationId(null);
          setMessages([]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "We could not load your chats.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, tab, enabled, canUse, activeKey, loadConversation]);

  React.useEffect(() => {
    if (!open) loadedRef.current = false;
  }, [open]);

  React.useEffect(() => {
    if (!open || !conversationId || !enabled || !canUse) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`agent:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (sendingRef.current) return;
          const saved = messageFrom(payload.new);
          if (!saved) return;
          setMessages((current) =>
            current.some((message) => message.id === saved.id)
              ? current
              : [...current, saved],
          );
          if (saved.role === "assistant") {
            setStreamingText("");
            setRemoteBusy(false);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_runs",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (sendingRef.current) return;
          const status = (payload.new as Record<string, unknown>).status;
          if (status === "queued" || status === "running") {
            setRemoteBusy(true);
            setStatusLabel("Assistant is answering");
            return;
          }
          setRemoteBusy(false);
          setStatusLabel("");
          if (status === "failed") {
            setError("The assistant could not answer. Please try again.");
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, conversationId, enabled, canUse]);

  React.useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, streamingText, sending, remoteBusy]);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = (returnFocusRef?.current ??
      document.activeElement) as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        returnFocusRef?.current?.focus();
        return;
      }
      if (!isMobile || event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null,
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (isMobile) previouslyFocused?.focus?.();
    };
  }, [open, isMobile, onClose, returnFocusRef]);

  function newChat() {
    if (sending) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setStreamingText("");
    setStatusLabel("");
    setRemoteBusy(false);
    setError(null);
    setHistoryOpen(false);
    if (typeof window !== "undefined") window.localStorage.removeItem(activeKey);
    closeRef.current?.focus();
  }

  async function openCreateSite() {
    if (sending) return;
    let cid = conversationId;
    if (!cid) {
      const created = await fetch("/api/agent/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: null }),
      });
      const data = (await created.json().catch(() => ({}))) as {
        conversation?: Conversation | null;
      };
      if (!created.ok || !data.conversation?.id) {
        setError("We could not start a chat.");
        return;
      }
      cid = data.conversation.id;
      setConversationId(cid);
      setConversations((current) => [data.conversation!, ...current]);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(activeKey, cid);
      }
    }
    setCreateSiteOpen(true);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending || needsCredits || !enabled || !canUse || pendingConfirmation) return;

    sendingRef.current = true;
    setSending(true);
    setError(null);
    setStreamingText("");
    setStatusLabel("Sending");
    const controller = new AbortController();
    abortRef.current = controller;
    const optimisticId = `local-${Date.now()}`;
    optimisticIdRef.current = optimisticId;
    setMessages((current) => [
      ...current,
      { id: optimisticId, role: "user", content: text },
    ]);
    setDraft("");

    try {
      let id = conversationId;
      if (!id) {
        const created = await fetch("/api/agent/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        const data = (await created.json().catch(() => ({}))) as Record<string, unknown>;
        if (!created.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "We could not start a chat.",
          );
        }
        const conversation =
          data.conversation && typeof data.conversation === "object"
            ? (data.conversation as Conversation)
            : null;
        if (!conversation?.id) throw new Error("We could not start a chat.");
        id = conversation.id;
        setConversationId(id);
        setConversations((current) => [conversation, ...current]);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(activeKey, id);
        }
      }

      const response = await fetch(`/api/agent/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: {
            route: window.location.pathname,
            pageTitle: document.title,
            projectName,
            teamName,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(
          typeof data.error === "string" ? data.error : "The assistant could not answer.",
        );
      }
      if (!response.body) throw new Error("The assistant could not answer.");

      setStatusLabel("Thinking");
      await readSse(response.body, (event, data) => {
        if (event === "message") {
          const saved = messageFrom(data);
          if (saved && saved.role === "user") {
            const optimistic = optimisticIdRef.current;
            optimisticIdRef.current = null;
            setMessages((current) =>
              optimistic
                ? current.map((message) => (message.id === optimistic ? saved : message))
                : [...current, saved],
            );
          }
          return;
        }
        if (event === "status" && typeof data.label === "string") {
          setStatusLabel(data.label);
          return;
        }
        if (event === "delta" && typeof data.text === "string") {
          setStreamingText((current) => current + data.text);
          return;
        }
        if (event === "confirmation_required") {
          setStreamingText("");
          setStatusLabel("");
          setSending(false);
          sendingRef.current = false;
          abortRef.current = null;
          const action = data.action as Record<string, unknown> | undefined;
          if (action) {
            setPendingConfirmation({
              id: String(action.id ?? ""),
              tool: String(action.tool ?? ""),
              summary: String(action.summary ?? ""),
              estimatedCredits: Number(action.estimatedCredits ?? 0),
              expiresAt: String(action.expiresAt ?? ""),
            });
          }
          return;
        }
        if (event === "error") {
          setError(
            typeof data.message === "string"
              ? data.message
              : "The assistant could not answer.",
          );
          setStatusLabel("");
          return;
        }
        if (event === "done") {
          const saved = messageFrom(data.message);
          if (saved) {
            setMessages((current) => [...current, saved]);
            setStreamingText("");
            setConversations((current) =>
              current
                .map((conversation) =>
                  conversation.id === id
                    ? {
                        ...conversation,
                        title:
                          conversation.title === "New chat"
                            ? text.length > 60
                              ? `${text.slice(0, 57)}...`
                              : text
                            : conversation.title,
                        lastMessageAt: new Date().toISOString(),
                      }
                    : conversation,
                )
                .sort(
                  (a, b) =>
                    Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt),
                ),
            );
          }
          if (typeof data.balance === "number") setBalance(data.balance);
          setStatusLabel("");
        }
      });
    } catch (sendError) {
      if (!controller.signal.aborted) {
        setError(
          sendError instanceof Error ? sendError.message : "The assistant could not answer.",
        );
        if (conversationIdRef.current) {
          void loadConversation(conversationIdRef.current);
        }
      }
      setStatusLabel("");
    } finally {
      sendingRef.current = false;
      setSending(false);
      abortRef.current = null;
      optimisticIdRef.current = null;
    }
  }

  async function confirmAction() {
    if (!pendingConfirmation || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/agent/actions/${pendingConfirmation.id}/confirm`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "We could not confirm that action.");
        return;
      }
      setPendingConfirmation(null);
      setEditingBrief(false);
      setError(null);
      if (conversationIdRef.current) void loadConversation(conversationIdRef.current);
    } catch {
      setError("We could not confirm that action. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function cancelAction() {
    if (!pendingConfirmation || sending) return;
    setSending(true);
    try {
      await fetch(`/api/agent/actions/${pendingConfirmation.id}/cancel`, { method: "POST" });
    } catch {
      // Ignore; we clear the card either way.
    } finally {
      setPendingConfirmation(null);
      setEditingBrief(false);
      setSending(false);
    }
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (isMobile) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    let latest = startWidth;

    function onMove(moveEvent: PointerEvent) {
      latest = clampAssistantWidth(startWidth + (startX - moveEvent.clientX));
      onWidthChange(latest);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onWidthChange(latest);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function resizeWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? 24 : -24;
    onWidthChange(clampAssistantWidth(widthRef.current + delta));
  }

  if (!open) return null;

  const showChat = tab === "assistant";
  const disabledCopy = !enabled
    ? "The assistant is taking a break. You can still get help from our team."
    : !canUse
      ? "Only editors, admins and the owner can use the assistant. You can still get help from our team."
      : null;

  return (
    <div className="fixed inset-0 z-50 min-[1024px]:pointer-events-none">
      <div
        className="absolute inset-0 bg-scrim min-[1024px]:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isMobile}
        aria-label="Assistant"
        tabIndex={-1}
        style={{ "--assistant-w": `${width}px` } as React.CSSProperties}
        className={cn(
          "absolute flex flex-col bg-surface outline-none max-[1023px]:inset-0",
          "animate-panel-in min-[1024px]:bottom-0 min-[1024px]:left-auto min-[1024px]:right-0 min-[1024px]:top-16 min-[1024px]:w-[var(--assistant-w)] min-[1024px]:border-l min-[1024px]:border-border min-[1024px]:shadow-raised min-[1024px]:pointer-events-auto",
        )}
      >
        <div
          role="separator"
          aria-label="Resize assistant"
          aria-orientation="vertical"
          aria-valuemin={ASSISTANT_MIN_WIDTH}
          aria-valuemax={ASSISTANT_MAX_WIDTH}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={startResize}
          onDoubleClick={() => onWidthChange(ASSISTANT_DEFAULT_WIDTH)}
          onKeyDown={resizeWithKeyboard}
          className="absolute -left-1 top-0 hidden h-full w-2 cursor-col-resize items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus min-[1024px]:flex"
        >
          <span aria-hidden className="h-12 w-1 rounded-full bg-border-strong" />
        </div>

        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3">
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-input bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => onTabChange("assistant")}
              aria-pressed={showChat}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-sm font-semibold transition-colors",
                showChat ? "bg-surface text-text shadow-input" : "text-text-muted",
              )}
            >
              <Sparkles size={16} strokeWidth={1.75} aria-hidden />
              Assistant
            </button>
            <button
              type="button"
              onClick={() => onTabChange("help")}
              aria-pressed={!showChat}
              className={cn(
                "flex h-9 items-center rounded-[8px] px-3 text-sm font-semibold transition-colors",
                !showChat ? "bg-surface text-text shadow-input" : "text-text-muted",
              )}
            >
              Help
            </button>
          </div>
          {showChat ? (
            <>
              <button
                type="button"
                onClick={newChat}
                disabled={sending}
                aria-label="New chat"
                title="New chat"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <MessageSquarePlus size={19} strokeWidth={1.75} aria-hidden />
              </button>
              {canUse ? (
                <button
                  type="button"
                  onClick={openCreateSite}
                  disabled={sending}
                  aria-label="Create website"
                  title="Create website"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  <Plus size={19} strokeWidth={2} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setHistoryOpen((value) => !value)}
                disabled={sending}
                aria-label="Chat history"
                aria-expanded={historyOpen}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-input hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50",
                  historyOpen ? "text-text" : "text-text-muted",
                )}
              >
                <History size={19} strokeWidth={1.75} aria-hidden />
              </button>
            </>
          ) : null}
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="Close assistant"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {showChat && historyOpen ? (
          <div className="max-h-56 shrink-0 overflow-y-auto border-b border-border p-2">
            {conversations.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-muted">No chats yet.</p>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    setHistoryOpen(false);
                    setError(null);
                    void loadConversation(conversation.id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-input px-3 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50",
                    conversation.id === conversationId
                      ? "bg-surface-muted font-semibold text-text"
                      : "text-text-muted hover:bg-surface-muted",
                  )}
                >
                  <Clock size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />
                  <span className="truncate">{conversation.title}</span>
                </button>
              ))
            )}
          </div>
        ) : null}

        {createSiteOpen && conversationId ? (
          <CreateSiteFlow
            conversationId={conversationId}
            teamId={teamId}
            userId={userId}
            planId={planId}
            onComplete={() => {
              setCreateSiteOpen(false);
              void loadConversation(conversationId);
            }}
            onClose={() => setCreateSiteOpen(false)}
          />
        ) : !showChat ? (
          <div className="flex-1 overflow-y-auto p-6">
            <HelpContent planId={planId} teamName={teamName} />
          </div>
        ) : disabledCopy ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
              <Sparkles size={22} strokeWidth={1.75} aria-hidden />
            </span>
            <p className="max-w-[32ch] text-[15px] text-text-muted">{disabledCopy}</p>
            <button
              type="button"
              onClick={() => onTabChange("help")}
              className="inline-flex h-11 items-center justify-center rounded-input bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover"
            >
              Get help from our team
            </button>
          </div>
        ) : (
          <>
            <div ref={listRef} className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
                  <Loader2 size={18} strokeWidth={1.75} className="animate-spin" aria-hidden />
                  Loading chat
                </div>
              ) : messages.length === 0 && !streamingText ? (
                <div className="flex h-full flex-col justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles size={21} strokeWidth={1.75} aria-hidden />
                  </span>
                  <h2 className="mt-4 text-h3">How can I help?</h2>
                  <p className="mt-1 text-[15px] text-text-muted">
                    Ask about your website, your plan or what to do next.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {[
                      "What can you do?",
                      "How do credits work?",
                      "How do I publish my website?",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setDraft(suggestion)}
                        className="rounded-full border border-border bg-surface px-3 py-2 text-left text-sm text-text hover:bg-surface-muted"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[88%] rounded-[14px] px-3.5 py-2.5 text-[15px]",
                        message.role === "user"
                          ? "self-end bg-primary text-on-primary"
                          : "self-start bg-surface-muted text-text",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      {message.role === "assistant" && (message.credits ?? 0) > 0 ? (
                        <p className="mt-1 text-xs opacity-70">
                          {message.credits} credit{message.credits === 1 ? "" : "s"} used
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {editingBrief && pendingConfirmation ? (
                    <div className="max-w-[88%] self-start rounded-[14px] bg-surface p-3 mb-3">
                      <p className="text-xs font-semibold text-text-muted mb-2">Edit the website details</p>
                      <div className="space-y-2">
                        <label className="text-[12px] font-semibold text-text-muted">Website name</label>
                        <input
                          value={briefForm.name}
                          onChange={(event) => setBriefForm({ ...briefForm, name: event.target.value })}
                          className="h-9 w-full rounded-input border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        />
                        <label className="text-[12px] font-semibold text-text-muted">Web address</label>
                        <input
                          value={briefForm.address}
                          onChange={(event) => setBriefForm({ ...briefForm, address: event.target.value })}
                          placeholder="something.get-on.tech"
                          className="h-9 w-full rounded-input border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        />
                        <label className="text-[12px] font-semibold text-text-muted">Business type</label>
                        <input
                          value={briefForm.businessType}
                          onChange={(event) => setBriefForm({ ...briefForm, businessType: event.target.value })}
                          placeholder="e.g. Bakery"
                          className="h-9 w-full rounded-input border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        />
                        <label className="text-[12px] font-semibold text-text-muted">About</label>
                        <input
                          value={briefForm.about}
                          onChange={(event) => setBriefForm({ ...briefForm, about: event.target.value })}
                          className="h-9 w-full rounded-input border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setDraft(
                              `Update the website brief: name "${briefForm.name}", address "${briefForm.address}", business type "${briefForm.businessType}", about "${briefForm.about}".`,
                            );
                            setEditingBrief(false);
                            await new Promise((resolve) => setTimeout(resolve, 0));
                            void send();
                          }}
                          disabled={sending}
                          className="flex-1 h-9 rounded-input border border-border bg-surface px-3 text-sm text-text transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
                        >
                          Save brief
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBrief(false)}
                          className="h-9 rounded-input border border-border bg-surface px-3 text-sm text-text-muted transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {streamingText ? (
                    <div className="max-w-[88%] self-start rounded-[14px] bg-surface-muted px-3.5 py-2.5 text-[15px] text-text">
                      <p className="whitespace-pre-wrap break-words">{streamingText}</p>
                    </div>
                  ) : null}
                  {pendingConfirmation ? (
                    <div className="max-w-[88%] self-start rounded-[14px] bg-warning-soft p-3 mb-3 border border-warning-border">
                      <p className="text-sm font-semibold text-warning-text mb-1">
                        {pendingConfirmation.summary}
                      </p>
                      <p className="text-xs text-warning-text mb-3">
                        Estimated {pendingConfirmation.estimatedCredits} credit{pendingConfirmation.estimatedCredits === 1 ? "" : "s"}.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={confirmAction}
                          disabled={sending}
                          className="flex-1 h-9 rounded-input border border-warning-border bg-warning text-warning-text px-3 font-semibold text-[13px] transition-colors hover:bg-warning-hover disabled:pointer-events-none disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={cancelAction}
                          disabled={sending}
                          className="h-9 rounded-input border border-border bg-surface px-3 text-sm text-text transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBrief(true);
                            setBriefForm({
                              name: "",
                              address: "",
                              businessType: "",
                              about: "",
                              style: "",
                            });
                          }}
                          disabled={sending}
                          className="h-9 rounded-input border border-border bg-surface px-3 text-sm text-text-muted transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {(sending || remoteBusy) && !streamingText && !pendingConfirmation ? (
                    <div className="flex items-center gap-2 self-start rounded-[14px] bg-surface-muted px-3.5 py-2.5 text-sm text-text-muted">
                      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden />
                      {statusLabel || "Assistant is answering"}
                    </div>
                  ) : null}
                </div>
              )}
              {error ? (
                <div role="alert" className="mt-3 rounded-info bg-danger-soft p-3 text-sm text-danger-text">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-border p-3">
              {needsCredits ? (
                <div
                  role="status"
                  className="mb-3 rounded-input bg-warning-soft px-3 py-2 text-sm text-warning-text"
                >
                  You are out of credits.{" "}
                  <Link
                    href="/dashboard/plan"
                    className="font-semibold underline underline-offset-2"
                  >
                    See plans
                  </Link>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, 4000))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  maxLength={4000}
                  placeholder="Ask the assistant..."
                  aria-label="Message the assistant"
                  className="max-h-40 min-h-11 flex-1 resize-none rounded-input border border-border bg-surface px-3 py-2.5 text-base text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending || needsCredits}
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input bg-primary text-on-primary transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 size={19} strokeWidth={1.75} className="animate-spin" aria-hidden />
                  ) : (
                    <ArrowUp size={20} strokeWidth={2} aria-hidden />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-text-muted">
                <span>
                  {ASSISTANT_CHAT_CREDITS} credit per reply. Check important details.
                </span>
                <span className="shrink-0">{balance.toLocaleString("en-GB")} credits</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
