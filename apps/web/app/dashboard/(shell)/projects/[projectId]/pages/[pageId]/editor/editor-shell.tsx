"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Monitor,
  Pencil,
  Redo2,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
} from "lucide-react";
import type { PageContentV5, Theme } from "@get-on/blocks";
import type { RenderImage } from "@get-on/renderer";
import { cn } from "@/lib/utils";
import { useEditorStore, type Device, type Zoom } from "@/lib/editor/v5-store";
import { generateEditorPage, savePageContent } from "./actions";
import { EditorCanvas, type CanvasBusiness } from "./canvas";
import { LeftPanel } from "./left-panel";
import { Inspector } from "./inspector";

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: "computer", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "phone", label: "Phone", icon: Smartphone },
];

export function EditorShell({
  projectId,
  pageId,
  title,
  initialContent,
  revision,
  theme,
  business,
  media,
  nav,
  protect,
  path,
}: {
  projectId: string;
  pageId: string;
  title: string;
  path: string;
  initialContent: PageContentV5;
  revision: number;
  theme: Theme;
  business: CanvasBusiness;
  media: Array<[string, RenderImage]>;
  nav: { label: string; href: string; pageId: string }[];
  protect: boolean;
}) {
  const content = useEditorStore((state) => state.content);
  const saveState = useEditorStore((state) => state.saveState);
  const lastError = useEditorStore((state) => state.lastError);
  const mode = useEditorStore((state) => state.mode);
  const width = useEditorStore((state) => state.width);
  const zoom = useEditorStore((state) => state.zoom);
  const device = useEditorStore((state) => state.device);
  const past = useEditorStore((state) => state.past);
  const future = useEditorStore((state) => state.future);
  const booted = React.useRef(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiBrief, setAiBrief] = React.useState("");
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiMessage, setAiMessage] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState(false);

  async function generatePage() {
    if (aiBusy || aiBrief.trim().length === 0) return;
    setAiBusy(true);
    setAiMessage(null);
    const result = await generateEditorPage({ projectId, brief: aiBrief.trim() });
    setAiBusy(false);
    if (!result.ok) {
      setAiMessage(result.message);
      return;
    }
    useEditorStore.getState().insertNodesAt(result.nodes);
    setAiOpen(false);
    setAiBrief("");
    setAiMessage(null);
  }

  React.useEffect(() => {
    const store = useEditorStore.getState();
    store.setContent(initialContent, { history: false });
    useEditorStore.setState({ savedContent: initialContent, revision, saveState: "saved", past: [], future: [] });
    booted.current = true;
  }, [initialContent, revision]);

  React.useEffect(() => {
    const onOffline = () => useEditorStore.getState().setSaveState("offline");
    const onOnline = () => {
      if (useEditorStore.getState().saveState === "offline") useEditorStore.getState().setSaveState("unsaved");
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  React.useEffect(() => {
    if (!booted.current) return;
    const state = useEditorStore.getState();
    if (state.saveState !== "unsaved") return;
    if (!navigator.onLine) {
      state.setSaveState("offline");
      return;
    }
    const timer = window.setTimeout(async () => {
      const current = useEditorStore.getState();
      const snapshot = current.content;
      current.setSaveState("saving");
      const result = await savePageContent({
        projectId,
        pageId,
        content: snapshot,
        expectedRevision: current.revision,
      });
      if (result.ok) {
        const latest = useEditorStore.getState();
        if (latest.content === snapshot) latest.markSaved(snapshot, result.revision);
        else useEditorStore.setState({ revision: result.revision, saveState: "unsaved" });
      } else if (result.code === "REVISION_CONFLICT") {
        setConflict(true);
        useEditorStore.getState().setSaveState("error", result.message);
      } else if (!navigator.onLine) {
        useEditorStore.getState().setSaveState("offline");
      } else {
        useEditorStore.getState().setSaveState("error", result.message);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [content, pageId, projectId]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const store = useEditorStore.getState();
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        const snapshot = store.content;
        store.setSaveState("saving");
        void savePageContent({ projectId, pageId, content: snapshot, expectedRevision: store.revision }).then((result) => {
          if (result.ok) {
            const latest = useEditorStore.getState();
            if (latest.content === snapshot) latest.markSaved(snapshot, result.revision);
            else useEditorStore.setState({ revision: result.revision, saveState: "unsaved" });
          } else if (result.code === "REVISION_CONFLICT") {
            setConflict(true);
            useEditorStore.getState().setSaveState("error", result.message);
          } else {
            useEditorStore.getState().setSaveState("error", result.message);
          }
        });
        return;
      }
      if (typing) return;
      if (command && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        store.undo();
      } else if ((command && event.key.toLowerCase() === "z" && event.shiftKey) || (command && event.key.toLowerCase() === "y")) {
        event.preventDefault();
        store.redo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (store.selectedId && store.selectedId !== "page") {
          event.preventDefault();
          store.remove(store.selectedId);
        }
      } else if (command && event.key.toLowerCase() === "d") {
        if (store.selectedId) {
          event.preventDefault();
          store.duplicate(store.selectedId);
        }
      } else if (event.altKey && event.key === "ArrowUp") {
        if (store.selectedId) {
          event.preventDefault();
          store.moveSibling(store.selectedId, -1);
        }
      } else if (event.altKey && event.key === "ArrowDown") {
        if (store.selectedId) {
          event.preventDefault();
          store.moveSibling(store.selectedId, 1);
        }
      } else if (command && event.key.toLowerCase() === "p" && event.altKey) {
        event.preventDefault();
        store.setMode(store.mode === "edit" ? "preview" : "edit");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageId, projectId]);

  const status = saveStatus(saveState);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col gap-3 overflow-hidden bg-surface-muted p-3 min-[640px]:h-[calc(100dvh-4rem)]">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-3">
        <Link
          href={`/dashboard/projects/${projectId}/pages`}
          className="flex h-9 items-center gap-2 rounded-input px-2 text-sm font-semibold text-text hover:bg-surface-muted"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          Pages
        </Link>
        <span className="h-6 w-px bg-border" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{title}</p>
          <p className={cn("text-[11px]", saveState === "error" ? "text-danger-text" : "text-text-muted")} role="status">
            {lastError ?? status}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Undo" disabled={past.length === 0} onClick={() => useEditorStore.getState().undo()}>
            <Undo2 size={17} />
          </IconButton>
          <IconButton label="Redo" disabled={future.length === 0} onClick={() => useEditorStore.getState().redo()}>
            <Redo2 size={17} />
          </IconButton>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="flex h-9 items-center gap-1 rounded-input border border-border px-3 text-sm font-semibold hover:bg-surface-muted"
          >
            <Sparkles size={15} /> Generate
          </button>
          <button
            type="button"
            onClick={() => useEditorStore.getState().setMode(mode === "edit" ? "preview" : "edit")}
            className="flex h-9 items-center gap-1 rounded-input border border-border px-3 text-sm font-semibold hover:bg-surface-muted"
          >
            <Eye size={15} /> Preview
          </button>
          <Link
            href={`/dashboard/projects/${projectId}/publish`}
            className="flex h-9 items-center gap-1 rounded-input bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary-hover"
          >
            <Save size={15} /> Publish
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-card border border-border bg-surface">
          <LeftPanel projectId={projectId} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border px-2">
              <div className="flex h-9 items-center rounded-input border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => useEditorStore.getState().setMode("edit")}
                  aria-pressed={mode === "edit"}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold",
                    mode === "edit" ? "bg-surface-muted text-text" : "text-text-muted",
                  )}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => useEditorStore.getState().setMode("preview")}
                  aria-pressed={mode === "preview"}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold",
                    mode === "preview" ? "bg-surface-muted text-text" : "text-text-muted",
                  )}
                >
                  <Eye size={13} /> Preview
                </button>
              </div>
              <div className="ml-auto flex items-center gap-1">
                {DEVICES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <IconButton
                      key={item.id}
                      label={item.label}
                      active={device === item.id}
                      onClick={() => useEditorStore.getState().setDevice(item.id)}
                    >
                      <Icon size={16} />
                    </IconButton>
                  );
                })}
                <input
                  type="number"
                  min={320}
                  max={1920}
                  value={width}
                  onChange={(event) => useEditorStore.getState().setWidth(Number(event.target.value))}
                  aria-label="Frame width in pixels"
                  className="h-8 w-[72px] rounded-input border border-border bg-surface px-2 text-xs"
                />
                <select
                  aria-label="Zoom"
                  value={String(zoom)}
                  onChange={(event) =>
                    useEditorStore.getState().setZoom(event.target.value === "fit" ? "fit" : (Number(event.target.value) as Zoom))
                  }
                  className="h-8 rounded-input border border-border bg-surface px-1 text-xs"
                >
                  <option value="fit">Fit</option>
                  {[50, 75, 100, 125, 150, 200].map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <EditorCanvas
              content={content}
              theme={theme}
              business={business}
              media={media}
              nav={nav}
              protect={protect}
              reportHref={`/report-site?host=${encodeURIComponent(business.name)}`}
            />
            <div className="flex min-h-8 items-center gap-2 border-t border-border px-3 text-[11px] text-text-muted">
              {mode === "preview" ? "Preview mode. Switch to Edit to change styles." : "Click an element to edit it. Double-click text to type."}
            </div>
          </div>
        </div>
        <Inspector projectId={projectId} pageId={pageId} pagePath={path} />
      </div>

      {conflict ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" role="alertdialog" aria-modal="true" aria-labelledby="save-conflict-title">
          <div className="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 id="save-conflict-title" className="text-h2">This page changed somewhere else</h2>
            <p className="mt-2 text-sm text-text-muted">
              Another tab or person saved this page after you opened it. Reload to get their latest version. Your
              unsaved changes on this screen will be lost.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConflict(false)}
                className="h-10 rounded-input border border-border px-4 text-sm font-semibold text-text hover:bg-surface-muted"
              >
                Keep looking
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-10 rounded-input bg-primary px-4 text-sm font-semibold text-on-primary"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {aiOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" role="dialog" aria-modal="true" aria-labelledby="generate-page-title">
          <div className="w-full max-w-lg rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 id="generate-page-title" className="text-h2">Generate a page with AI</h2>
            <p className="mt-1 text-sm text-text-muted">
              Describe the page in your own words. AI adds a draft you can change. Nothing goes live until you publish.
            </p>
            <textarea
              value={aiBrief}
              onChange={(event) => setAiBrief(event.target.value)}
              rows={4}
              autoFocus
              placeholder="For example: a page for a family plumbing business in Nairobi, with services, reviews and a contact form"
              className="mt-3 w-full rounded-input border border-border bg-surface p-3 text-sm text-text outline-none focus:border-primary"
            />
            {aiMessage ? <p className="mt-2 text-sm text-danger-text">{aiMessage}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                className="h-10 rounded-input border border-border px-4 text-sm font-semibold text-text hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void generatePage()}
                disabled={aiBusy || aiBrief.trim().length === 0}
                className="h-10 rounded-input bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
              >
                {aiBusy ? "Writing…" : "Generate page"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function saveStatus(state: string): string {
  switch (state) {
    case "saving":
      return "Saving…";
    case "unsaved":
      return "Saved as draft";
    case "error":
      return "Not saved. Try again.";
    case "offline":
      return "Offline. Changes stay here until you reconnect.";
    default:
      return "Saved as draft";
  }
}

function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-input border border-border text-text hover:bg-surface-muted disabled:opacity-40",
        active && "border-primary bg-primary-soft",
      )}
    >
      {children}
    </button>
  );
}
