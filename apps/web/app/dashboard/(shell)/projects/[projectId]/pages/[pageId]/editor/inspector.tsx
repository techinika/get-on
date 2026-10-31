"use client";

import * as React from "react";
import {
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Lock,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  STYLE_GROUPS,
  THEME_TOKENS,
  findNode,
  richTextFromPlain,
  richTextToPlain,
  type ContentNode,
  type LinkTarget,
  type RichNode,
} from "@get-on/blocks";
import { cn } from "@/lib/utils";
import { nodeLabel } from "@/lib/editor/registry";
import { useEditorStore, type Device, type StateKey } from "@/lib/editor/v5-store";
import { RichTextEditor } from "./rich-text";
import { improveEditorText, listEditorMedia, updatePageBasics, type EditorMediaItem } from "./actions";

type Tab = "settings" | "style" | "advanced";

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: "computer", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "phone", label: "Phone", icon: Smartphone },
];

const STATES: { id: StateKey; label: string }[] = [
  { id: "base", label: "Normal" },
  { id: "hover", label: "Hover" },
  { id: "focus", label: "Focus" },
  { id: "active", label: "Active" },
];

export function Inspector({ projectId, pageId, pagePath }: { projectId: string; pageId: string; pagePath: string }) {
  const open = useEditorStore((state) => state.rightOpen);
  const toggle = useEditorStore((state) => state.toggleRight);
  const content = useEditorStore((state) => state.content);
  const selectedId = useEditorStore((state) => state.selectedId);
  const node = selectedId ? findNode(content.root, selectedId) : null;
  const device = useEditorStore((state) => state.device);
  const stateKey = useEditorStore((state) => state.stateKey);
  const setDevice = useEditorStore((state) => state.setDevice);
  const setStateKey = useEditorStore((state) => state.setStateKey);
  const [tab, setTab] = React.useState<Tab>("settings");

  if (!open) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center gap-2 border-l border-border bg-surface py-3">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
          onClick={() => toggle(true)}
          aria-label="Open the style panel"
        >
          <ChevronDown size={18} className="-rotate-90" strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface">
      <div className="flex h-14 items-center gap-2 border-b border-border px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-text">{node ? nodeLabel(node) : "Page"}</p>
          <p className="truncate text-xs text-text-muted">{node ? node.type : "Nothing selected"}</p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
          onClick={() => toggle(false)}
          aria-label="Close the style panel"
        >
          <ChevronDown size={18} className="rotate-90" strokeWidth={1.75} />
        </button>
      </div>

      {node && node.type !== "page" ? (
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-1">
            {DEVICES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDevice(item.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-input border border-border text-text hover:bg-surface-muted aria-pressed:border-primary aria-pressed:bg-primary-soft"
                  aria-label={item.label}
                  aria-pressed={device === item.id}
                >
                  <Icon size={15} />
                </button>
              );
            })}
            <select
              aria-label="Style state"
              value={stateKey}
              onChange={(event) => setStateKey(event.target.value as StateKey)}
              className="ml-auto h-8 rounded-input border border-border bg-surface px-2 text-xs font-semibold"
            >
              {STATES.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2">
        {(["settings", "style", "advanced"] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "h-8 flex-1 rounded-input px-2 text-xs font-bold capitalize",
              tab === item ? "bg-surface-muted text-text" : "text-text-muted hover:bg-surface-muted",
            )}
            aria-pressed={tab === item}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!node || node.type === "page" ? (
          <PagePanel projectId={projectId} pageId={pageId} pagePath={pagePath} />
        ) : tab === "settings" ? (
          <SettingsTab node={node} projectId={projectId} />
        ) : tab === "style" ? (
          <StyleTab node={node} />
        ) : (
          <AdvancedTab node={node} />
        )}
      </div>
    </aside>
  );
}

function PagePanel({ projectId, pageId, pagePath }: { projectId: string; pageId: string; pagePath: string }) {
  const content = useEditorStore((state) => state.content);
  const setContent = useEditorStore((state) => state.setContent);
  const bytes = new TextEncoder().encode(content.css ?? "").length;

  return (
    <div className="space-y-4">
      <PageBasicsPanel projectId={projectId} pageId={pageId} pagePath={pagePath} />
      <section>
        <h3 className="text-sm font-semibold text-text">Page</h3>
        <p className="mt-1 text-xs text-text-muted">
          Select an element to change its settings and styles. With nothing selected you can edit the page CSS.
        </p>
      </section>
      <section>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="page-css" className="text-xs font-semibold text-text">
            Page CSS
          </label>
          <span className="text-[11px] text-text-muted">{(bytes / 1024).toFixed(1)} of 20 KB</span>
        </div>
        <textarea
          id="page-css"
          value={content.css ?? ""}
          onChange={(event) => setContent({ ...content, css: event.target.value }, { group: "page-css" })}
          rows={12}
          spellCheck={false}
          placeholder={".gs-root {\n  /* your CSS */\n}"}
          className="w-full rounded-input border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-primary"
        />
        <p className="mt-1 text-[11px] text-text-muted">
          Custom CSS only affects this page. Important rules, scripts and external URLs are blocked.
        </p>
      </section>
      <Tips />
    </div>
  );
}

function Tips() {
  return (
    <section>
      <h3 className="text-sm font-semibold text-text">Page tips</h3>
      <ul className="mt-2 space-y-1 text-xs text-text-muted">
        <li>Keep one clear next step on each section.</li>
        <li>Check the page on a phone before you publish.</li>
        <li>Publish when the page looks right. Changes are drafts until then.</li>
      </ul>
    </section>
  );
}

function SettingsTab({ node, projectId }: { node: ContentNode; projectId: string }) {
  const updateProps = useEditorStore((state) => state.updateProps);
  const duplicate = useEditorStore((state) => state.duplicate);
  const remove = useEditorStore((state) => state.remove);

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => duplicate(node.id)}
          className="flex h-8 flex-1 items-center justify-center gap-1 rounded-input border border-border text-xs font-semibold hover:bg-surface-muted"
        >
          <Copy size={13} /> Duplicate
        </button>
        <button
          type="button"
          onClick={() => remove(node.id)}
          className="flex h-8 flex-1 items-center justify-center gap-1 rounded-input border border-border text-xs font-semibold text-danger-text hover:bg-danger-soft"
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>

      {node.type === "heading" ? (
        <>
          <Field label="Text">
            <RichTextEditor key={node.id} node={node} />
          </Field>
          <AiTextActions node={node} projectId={projectId} />
          <Field label="Level">
            <select
              value={String(node.props?.level ?? "h2")}
              onChange={(event) => updateProps(node.id, { level: event.target.value })}
              className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
            >
              {["h1", "h2", "h3", "h4", "h5", "h6"].map((level) => (
                <option key={level} value={level}>
                  {level.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}

      {node.type === "text" ? (
        <>
          <Field label="Text">
            <RichTextEditor key={node.id} node={node} />
          </Field>
          <AiTextActions node={node} projectId={projectId} />
        </>
      ) : null}

      {node.type === "button" ? (
        <>
          <Field label="Label">
            <input
              value={String(node.props?.label ?? "")}
              onChange={(event) => updateProps(node.id, { label: event.target.value }, { group: `label:${node.id}` })}
              className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
            />
          </Field>
          <Field label="Style">
            <select
              value={String(node.props?.style ?? "solid")}
              onChange={(event) => updateProps(node.id, { style: event.target.value })}
              className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
            >
              {["solid", "outline", "soft", "plain"].map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </Field>
          <LinkField node={node} />
        </>
      ) : null}

      {node.type === "list" ? (
        <Field label="Items, one per line">
          <textarea
            value={(Array.isArray(node.props?.items) ? (node.props?.items as unknown[]) : []).join("\n")}
            onChange={(event) =>
              updateProps(
                node.id,
                { items: event.target.value.split("\n").filter((line) => line.trim().length > 0) },
                { group: `items:${node.id}` },
              )
            }
            rows={5}
            className="w-full rounded-input border border-border bg-surface p-2 text-sm"
          />
        </Field>
      ) : null}

      {node.type === "image" ? (
        <>
          <ImageField node={node} projectId={projectId} />
          <Field label="Alt text">
            <input
              value={String(node.props?.alt ?? "")}
              onChange={(event) => updateProps(node.id, { alt: event.target.value }, { group: `alt:${node.id}` })}
              className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
            />
          </Field>
        </>
      ) : null}

      {node.type === "divider" ? (
        <Field label="Style">
          <select
            value={String(node.props?.style ?? "line")}
            onChange={(event) => updateProps(node.id, { style: event.target.value })}
            className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
          >
            {["line", "dots", "short"].map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {node.type === "spacer" ? (
        <Field label="Height">
          <select
            value={String(node.props?.height ?? "medium")}
            onChange={(event) => updateProps(node.id, { height: event.target.value })}
            className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
          >
            {["small", "medium", "large"].map((height) => (
              <option key={height} value={height}>
                {height}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {node.type === "video" ? (
        <Field label="Video link">
          <input
            value={String(node.props?.url ?? "")}
            onChange={(event) => updateProps(node.id, { url: event.target.value }, { group: `url:${node.id}` })}
            placeholder="https://"
            className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
          />
        </Field>
      ) : null}

      {node.type === "icon" ? (
        <Field label="Icon name">
          <input
            value={String(node.props?.name ?? "star")}
            onChange={(event) => updateProps(node.id, { name: event.target.value }, { group: `icon:${node.id}` })}
            className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
          />
        </Field>
      ) : null}

      {node.type === "accordion-item" ? (
        <>
          <Field label="Question">
            <input
              value={String(node.props?.title ?? "")}
              onChange={(event) => updateProps(node.id, { title: event.target.value }, { group: `title:${node.id}` })}
              className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
            />
          </Field>
          <Switch
            label="Open by default"
            checked={node.props?.open === true}
            onChange={(checked) => updateProps(node.id, { open: checked })}
          />
        </>
      ) : null}

      {node.type === "html" ? (
        <Field label="HTML">
          <textarea
            value={String(node.props?.html ?? "")}
            onChange={(event) => updateProps(node.id, { html: event.target.value }, { group: `html:${node.id}` })}
            rows={8}
            spellCheck={false}
            className="w-full rounded-input border border-border bg-surface p-2 font-mono text-xs"
          />
          <p className="mt-1 text-[11px] text-text-muted">Scripts and unsafe markup are removed when you save.</p>
        </Field>
      ) : null}

      {node.type === "section" ? (
        <>
          <Field label="Name">
            <input
              value={String(node.props?.name ?? "")}
              onChange={(event) => updateProps(node.id, { name: event.target.value }, { group: `name:${node.id}` })}
              className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
            />
          </Field>
          <BackgroundChips node={node} />
        </>
      ) : null}

      {node.type === "smart" ? <SmartFields node={node} /> : null}

      {["container", "stack", "columns", "column", "grid", "accordion", "page"].includes(node.type) ? (
        <p className="text-xs text-text-muted">Use the Style tab to change the layout, spacing and look.</p>
      ) : null}
    </div>
  );
}

function AiTextActions({ node, projectId }: { node: ContentNode; projectId: string }) {
  const updateProps = useEditorStore((state) => state.updateProps);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [credits, setCredits] = React.useState<number | null>(null);
  const presets = [
    { key: "Rewrite", instruction: "Rewrite this in a natural, plain way. Keep the same meaning and length." },
    { key: "Shorter", instruction: "Make this shorter without losing the important meaning." },
    { key: "Longer", instruction: "Make this a little longer with useful detail. Do not invent facts." },
    { key: "Fix", instruction: "Fix spelling and grammar. Do not change the meaning." },
    { key: "Friendlier", instruction: "Make this friendlier and warmer. Keep it plain and short." },
  ];

  async function run(preset: (typeof presets)[number]) {
    if (busy) return;
    const text = richTextToPlain((node.props?.rich as RichNode | undefined) ?? String(node.props?.text ?? "")).trim();
    if (!text) {
      setMessage("Write something first, then ask AI to help.");
      return;
    }
    setBusy(preset.key);
    setMessage(null);
    const result = await improveEditorText({ projectId, text, instruction: preset.instruction });
    setBusy(null);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    updateProps(node.id, { rich: richTextFromPlain(result.text), text: result.text });
    setCredits(result.credits);
    setMessage("Updated. You can undo this.");
  }

  return (
    <div className="rounded-input border border-border bg-accent-soft p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-accent-text">Ask AI to help with these words</span>
        {credits != null ? <span className="text-[11px] text-accent-text">{credits} credits</span> : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            disabled={busy != null}
            onClick={() => void run(preset)}
            className="h-7 rounded-input border border-border bg-surface px-2 text-[11px] font-semibold text-text hover:bg-surface-muted disabled:opacity-50"
          >
            {busy === preset.key ? "Working…" : preset.key}
          </button>
        ))}
      </div>
      {message ? <p className="mt-1 text-[11px] text-text-muted">{message}</p> : null}
    </div>
  );
}

function ImageField({ node, projectId }: { node: ContentNode; projectId: string }) {
  const updateProps = useEditorStore((state) => state.updateProps);
  const [open, setOpen] = React.useState(false);
  const [media, setMedia] = React.useState<EditorMediaItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const currentId = String(node.props?.imageId ?? "");

  async function openPicker() {
    setOpen(true);
    if (media.length > 0) return;
    setLoading(true);
    const items = await listEditorMedia(projectId);
    setMedia(items);
    setLoading(false);
  }

  const current = media.find((item) => item.id === currentId);

  return (
    <Field label="Picture">
      <button
        type="button"
        onClick={() => void openPicker()}
        className="flex w-full items-center gap-2 rounded-input border border-border bg-surface p-2 text-left hover:border-primary"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-input bg-surface-muted text-text-muted">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.src} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={20} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-text">{current ? current.alt || "Picture selected" : "Choose a picture"}</span>
          <span className="block text-xs text-text-muted">{currentId ? "Change picture" : "From your Images library"}</span>
        </span>
      </button>
      {currentId && !current ? (
        <p className="mt-1 text-[11px] text-text-muted">This picture is no longer in your library. Choose another one.</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" role="dialog" aria-modal="true" aria-labelledby="choose-picture-title">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="choose-picture-title" className="text-h2">Choose a picture</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-input border border-border px-3 text-sm font-semibold text-text hover:bg-surface-muted"
              >
                Close
              </button>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-auto">
              {loading ? (
                <p className="text-sm text-text-muted">Loading your pictures…</p>
              ) : media.length === 0 ? (
                <p className="text-sm text-text-muted">
                  You have not added any pictures yet. Add them in the Images area first.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {media.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        updateProps(node.id, { imageId: item.id, alt: String(node.props?.alt ?? "") || item.alt });
                        setOpen(false);
                      }}
                      className={cn(
                        "overflow-hidden rounded-input border bg-surface-muted text-left hover:border-primary",
                        item.id === currentId ? "border-primary ring-2 ring-primary" : "border-border",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.src} alt={item.alt} className="aspect-[4/3] w-full object-cover" />
                      <span className="block truncate px-2 py-1 text-xs text-text">{item.alt || "Picture"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Field>
  );
}

function PageBasicsPanel({ projectId, pageId, pagePath }: { projectId: string; pageId: string; pagePath: string }) {
  const content = useEditorStore((state) => state.content);
  const [title, setTitle] = React.useState(() => String(content.meta?.title ?? "").trim());
  const [path, setPath] = React.useState(pagePath);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await updatePageBasics({ projectId, pageId, title, path });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("Page settings saved.");
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-text">Page settings</h3>
      <div className="space-y-2">
        <Field label="Page title">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled page"
            className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
          />
        </Field>
        <Field label="Page address">
          <div className="flex items-center gap-2">
            <span className="flex items-center text-xs text-text-muted">/{" "}</span>
            <input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="about"
              className="flex-1 h-9 rounded-input border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
            />
          </div>
        </Field>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="h-8 rounded-input border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-muted disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save page settings"}
        </button>
        {message ? <p className="mt-1 text-[11px] text-text-muted">{message}</p> : null}
      </div>
    </section>
  );
}


function SmartFields({ node }: { node: ContentNode }) {
  const updateProps = useEditorStore((state) => state.updateProps);
  const entries = Object.entries(node.props ?? {}).filter(
    ([key, value]) =>
      !["kind", "sec", "includeIf", "slotMeta"].includes(key) &&
      (typeof value === "string" || typeof value === "number") &&
      String(value).length > 0,
  );
  return (
    <div className="space-y-3">
      <p className="rounded-input bg-accent-soft p-2 text-xs text-accent-text">
        This is a ready-made section. You can edit its words here, or change its look in the Style tab.
      </p>
      {entries.map(([key, value]) => (
        <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}>
          {String(value).length > 80 ? (
            <textarea
              value={String(value)}
              onChange={(event) => updateProps(node.id, { [key]: event.target.value }, { group: `smart:${node.id}:${key}` })}
              rows={3}
              className="w-full rounded-input border border-border bg-surface p-2 text-sm"
            />
          ) : (
            <input
              value={String(value)}
              onChange={(event) => updateProps(node.id, { [key]: event.target.value }, { group: `smart:${node.id}:${key}` })}
              className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
            />
          )}
        </Field>
      ))}
    </div>
  );
}

function LinkField({ node }: { node: ContentNode }) {
  const updateProps = useEditorStore((state) => state.updateProps);
  const link = (node.props?.link ?? { type: "none" }) as LinkTarget;
  const setLink = (next: LinkTarget) => updateProps(node.id, { link: next });

  return (
    <div className="space-y-2 rounded-input border border-border p-2">
      <Field label="Link">
        <select
          value={link.type}
          onChange={(event) => {
            const type = event.target.value as LinkTarget["type"];
            setLink({ type } as LinkTarget);
          }}
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        >
          <option value="none">No link</option>
          <option value="url">Website address</option>
          <option value="page">Page on this website</option>
          <option value="phone">Phone number</option>
          <option value="email">Email address</option>
          <option value="section">Section on this page</option>
        </select>
      </Field>
      {link.type === "url" ? (
        <input
          value={link.url ?? ""}
          onChange={(event) => setLink({ type: "url", url: event.target.value })}
          placeholder="https://"
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        />
      ) : null}
      {link.type === "page" ? (
        <input
          value={link.pageId ?? ""}
          onChange={(event) => setLink({ type: "page", pageId: event.target.value })}
          placeholder="Page id"
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        />
      ) : null}
      {link.type === "phone" ? (
        <input
          value={link.number ?? ""}
          onChange={(event) => setLink({ type: "phone", number: event.target.value })}
          placeholder="+44 20 7946 0000"
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        />
      ) : null}
      {link.type === "email" ? (
        <input
          value={link.address ?? ""}
          onChange={(event) => setLink({ type: "email", address: event.target.value })}
          placeholder="hello@example.com"
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        />
      ) : null}
      {link.type === "section" ? (
        <input
          value={link.anchor ?? ""}
          onChange={(event) => setLink({ type: "section", anchor: event.target.value })}
          placeholder="section-name"
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        />
      ) : null}
    </div>
  );
}

function BackgroundChips({ node }: { node: ContentNode }) {
  const updateStyles = useEditorStore((state) => state.updateStyles);
  const current = String(node.styles?.base?.["background-color"] ?? "");
  const options = [
    { label: "Plain", value: "{bg}" },
    { label: "Soft", value: "{soft}" },
    { label: "Brand", value: "{primary}" },
    { label: "Accent", value: "{accent}" },
  ];
  return (
    <Field label="Background">
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => updateStyles(node.id, "base", "background-color", option.value)}
            className={cn(
              "h-8 rounded-input border px-3 text-xs font-semibold",
              current === option.value ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

function StyleTab({ node }: { node: ContentNode }) {
  const device = useEditorStore((state) => state.device);
  const stateKey = useEditorStore((state) => state.stateKey);
  const updateStyles = useEditorStore((state) => state.updateStyles);
  const activeKey: StateKey = stateKey === "base" ? (device === "computer" ? "base" : device) : stateKey;
  const declarations = node.styles?.[activeKey] ?? {};
  const inherited = activeKey !== "base" ? node.styles?.base ?? {} : {};

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-text-muted">
        {activeKey === "base" ? "Desktop" : activeKey === "tablet" ? "Tablet and smaller" : activeKey === "phone" ? "Phone and smaller" : stateKey} styles.
        Theme colours use {"{token}"} names.
      </p>
      {STYLE_GROUPS.map((group) => (
        <details key={group.id} className="rounded-input border border-border" open={group.id === "size" || group.id === "typography"}>
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-2 text-xs font-bold text-text [&::-webkit-details-marker]:hidden">
            <ChevronDown size={14} className="text-text-muted transition-transform [details[open]_&]:rotate-0" />
            {group.label}
            {Object.keys(declarations).some((prop) => group.props.some((item) => item.prop === prop)) ? (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-label="Has values" />
            ) : null}
          </summary>
          <div className="space-y-2 border-t border-border p-2">
            {group.props.map((item) => {
              const value = declarations[item.prop];
              const placeholder = inherited[item.prop] != null ? String(inherited[item.prop]) : "";
              return (
                <div key={item.prop} className="flex items-center gap-2">
                  <label htmlFor={`style-${node.id}-${item.prop}`} className="w-28 shrink-0 text-[11px] text-text-muted">
                    {item.label}
                  </label>
                  <input
                    id={`style-${node.id}-${item.prop}`}
                    value={value == null ? "" : String(value)}
                    placeholder={placeholder}
                    list={item.control === "colour" ? "gs-theme-tokens" : undefined}
                    onChange={(event) =>
                      updateStyles(node.id, activeKey, item.prop, event.target.value === "" ? null : event.target.value)
                    }
                    className="h-8 min-w-0 flex-1 rounded-input border border-border bg-surface px-2 text-xs"
                  />
                  {value != null ? (
                    <button
                      type="button"
                      onClick={() => updateStyles(node.id, activeKey, item.prop, null)}
                      className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-surface-muted"
                      aria-label={`Reset ${item.label}`}
                    >
                      <Undo2 size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      ))}
      <datalist id="gs-theme-tokens">
        {THEME_TOKENS.map((token) => (
          <option key={token} value={`{${token}}`} />
        ))}
      </datalist>
      <p className="text-[11px] text-text-muted">
        Tablet and phone styles only override what you set here. Everything else stays as it is on desktop.
      </p>
    </div>
  );
}

function AdvancedTab({ node }: { node: ContentNode }) {
  const updateNode = useEditorStore((state) => state.updateNode);
  const updateProps = useEditorStore((state) => state.updateProps);
  const device = useEditorStore((state) => state.device);

  return (
    <div className="space-y-4">
      <Field label="Anchor">
        <input
          value={String(node.attrs?.id ?? "")}
          onChange={(event) =>
            updateNode(node.id, { attrs: { ...(node.attrs ?? {}), id: event.target.value } }, { group: `anchor:${node.id}` })
          }
          placeholder="section-name"
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        />
      </Field>
      <Field label="CSS classes">
        <input
          value={(node.classes ?? []).join(", ")}
          onChange={(event) =>
            updateNode(
              node.id,
              { classes: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) },
              { group: `classes:${node.id}` },
            )
          }
          placeholder="my-class, another-class"
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        />
      </Field>
      <Field label="Screen reader label">
        <input
          value={String(node.attrs?.ariaLabel ?? "")}
          onChange={(event) =>
            updateNode(
              node.id,
              { attrs: { ...(node.attrs ?? {}), ariaLabel: event.target.value } },
              { group: `aria:${node.id}` },
            )
          }
          className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
        />
      </Field>
      <Field label={`Hide on ${device}`}>
        <Switch
          label="Hide on this device"
          checked={Boolean(node.hidden?.[device])}
          onChange={(checked) =>
            updateNode(
              node.id,
              { hidden: { ...(node.hidden ?? {}), [device]: checked || undefined } },
              { group: `hidden:${node.id}` },
            )
          }
        />
      </Field>
      <Field label="Lock">
        <Switch
          label="Prevent moving and deleting"
          checked={node.locked === true}
          onChange={(checked) => updateNode(node.id, { locked: checked })}
        />
      </Field>
      {node.type === "heading" ? (
        <Field label="HTML tag">
          <select
            value={String(node.props?.level ?? "h2")}
            onChange={(event) => updateProps(node.id, { level: event.target.value })}
            className="h-9 w-full rounded-input border border-border bg-surface px-2 text-sm"
          >
            {["h1", "h2", "h3", "h4", "h5", "h6"].map((level) => (
              <option key={level} value={level}>
                {level.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Editor note">
        <textarea
          value={node.note ?? ""}
          onChange={(event) => updateNode(node.id, { note: event.target.value }, { group: `note:${node.id}` })}
          rows={3}
          maxLength={200}
          className="w-full rounded-input border border-border bg-surface p-2 text-sm"
        />
      </Field>
      <p className="flex items-center gap-1 text-[11px] text-text-muted">
        <Lock size={12} aria-hidden /> Advanced settings are for people who know the page well.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold text-text">{label}</span>
      {children}
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center justify-between gap-3 rounded-input border border-border px-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
    </label>
  );
}
