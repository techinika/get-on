"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Layers,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  ArrowUp,
  ArrowDown,
  EyeOff,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import { cloneNode, createNode, defaultSmartProps, findNode, findParent, validateContentV5, type ContentNode } from "@get-on/blocks";
import { cn } from "@/lib/utils";
import { ELEMENTS, ELEMENT_GROUPS, NODE_ICONS, PATTERNS, SMART_SECTIONS, nodeLabel } from "@/lib/editor/registry";
import { Box } from "lucide-react";
import { useEditorStore } from "@/lib/editor/v5-store";
import { deleteEditorPattern, generateEditorSections, listEditorPatterns, recordEditorPatternUse, saveEditorPattern, type SavedPattern } from "./actions";

export function LeftPanel({ projectId }: { projectId: string }) {
  const tab = useEditorStore((state) => state.leftTab);
  const setTab = useEditorStore((state) => state.setLeftTab);
  const open = useEditorStore((state) => state.leftOpen);
  const toggle = useEditorStore((state) => state.toggleLeft);
  const content = useEditorStore((state) => state.content);
  const count = useEditorStore((state) => state.nodeCount());

  if (!open) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center gap-2 border-r border-border bg-surface py-3">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
          onClick={() => toggle(true)}
          aria-label="Open the add panel"
        >
          <Plus size={18} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
          onClick={() => {
            setTab("layers");
            toggle(true);
          }}
          aria-label="Open the layers panel"
        >
          <Layers size={18} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r border-border bg-surface">
      <div className="flex h-12 items-center gap-1 border-b border-border px-2">
        <button
          type="button"
          className={cn(
            "h-9 flex-1 rounded-input px-3 text-sm font-semibold",
            tab === "add" ? "bg-surface-muted text-text" : "text-text-muted hover:bg-surface-muted",
          )}
          onClick={() => setTab("add")}
          aria-pressed={tab === "add"}
        >
          Add
        </button>
        <button
          type="button"
          className={cn(
            "h-9 flex-1 rounded-input px-2 text-sm font-semibold",
            tab === "patterns" ? "bg-surface-muted text-text" : "text-text-muted hover:bg-surface-muted",
          )}
          onClick={() => setTab("patterns")}
          aria-pressed={tab === "patterns"}
        >
          Patterns
        </button>
        <button
          type="button"
          className={cn(
            "h-9 flex-1 rounded-input px-3 text-sm font-semibold",
            tab === "layers" ? "bg-surface-muted text-text" : "text-text-muted hover:bg-surface-muted",
          )}
          onClick={() => setTab("layers")}
          aria-pressed={tab === "layers"}
        >
          Layers
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
          onClick={() => toggle(false)}
          aria-label="Close the left panel"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>
      {tab === "add" ? (
        <AddTab projectId={projectId} />
      ) : tab === "patterns" ? (
        <PatternsTab projectId={projectId} />
      ) : (
        <LayersTab count={count} root={content.root} />
      )}
    </aside>
  );
}

function AddTab({ projectId }: { projectId: string }) {
  const insert = useEditorStore((state) => state.insert);
  const insertSmart = useEditorStore((state) => state.insertSmart);
  const insertNodesAt = useEditorStore((state) => state.insertNodesAt);
  const [query, setQuery] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [credits, setCredits] = React.useState<number | null>(null);
  const needle = query.trim().toLowerCase();

  async function generate() {
    if (brief.trim().length === 0 || busy) return;
    setBusy(true);
    setMessage(null);
    const result = await generateEditorSections({ projectId, brief: brief.trim() });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    insertNodesAt(result.nodes);
    setCredits(result.credits);
    setBrief("");
    setMessage("Added to your page as a draft.");
  }

  const elements = ELEMENTS.filter((item) => !needle || item.label.toLowerCase().includes(needle));
  const sections = SMART_SECTIONS.filter(
    (item) => !needle || item.label.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle),
  );

  return (
    <div className="flex-1 overflow-auto p-3">
      <label className="relative block">
        <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search elements and sections"
          className="h-9 w-full rounded-input border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none focus:border-primary"
        />
      </label>

      <div className="mt-3 rounded-input border border-border bg-accent-soft p-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-input bg-surface text-accent-text">
            <Sparkles size={16} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-sm font-semibold text-accent-text">Describe a section</span>
          {credits != null ? <span className="ml-auto text-[11px] text-accent-text">{credits} credits</span> : null}
        </div>
        <input
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void generate();
          }}
          placeholder="For example: three pricing cards with a highlighted middle plan"
          className="mt-2 h-9 w-full rounded-input border border-border bg-surface px-2 text-xs text-text outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || brief.trim().length === 0}
          className="mt-2 h-8 w-full rounded-input bg-primary text-xs font-semibold text-on-primary disabled:opacity-50"
        >
          {busy ? "Writing…" : "Generate section"}
        </button>
        {message ? <p className="mt-1 text-[11px] text-text-muted">{message}</p> : null}
      </div>

      {ELEMENT_GROUPS.map((group) => {
        const items = elements.filter((item) => item.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="mt-4">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">{group}</h3>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${item.type}-${item.label}`}
                    type="button"
                    onClick={() => insert(item.type, item.props)}
                    className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-input border border-border bg-surface px-2 py-2 text-center text-[13px] font-semibold text-text hover:border-primary hover:shadow-card"
                  >
                    <Icon size={22} strokeWidth={1.6} aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {sections.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">Sections</h3>
          <div className="space-y-2">
            {sections.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => insertSmart(item.kind)}
                  className="flex w-full items-center gap-3 rounded-input border border-border bg-surface p-2 text-left hover:border-primary hover:shadow-card"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-surface-muted text-primary">
                    <Icon size={20} strokeWidth={1.6} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text">{item.label}</span>
                    <span className="block truncate text-xs text-text-muted">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PatternsTab({ projectId }: { projectId: string }) {
  const insertNodesAt = useEditorStore((state) => state.insertNodesAt);
  const content = useEditorStore((state) => state.content);
  const selectedId = useEditorStore((state) => state.selectedId);
  const [category, setCategory] = React.useState("All");
  const [saved, setSaved] = React.useState<SavedPattern[]>([]);
  const [savedState, setSavedState] = React.useState<"loading" | "ready" | "error">("loading");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const categories = ["All", ...Array.from(new Set(PATTERNS.map((item) => item.category)))];
  const patterns = PATTERNS.filter((item) => category === "All" || item.category === category);
  const selected = selectedId ? findNode(content.root, selectedId) : null;
  const canSave = Boolean(selected && selected.type !== "page");

  React.useEffect(() => {
    let alive = true;
    void listEditorPatterns().then((result) => {
      if (!alive) return;
      if (result.ok) {
        setSaved(result.patterns);
        setSavedState("ready");
      } else {
        setSavedState("error");
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    if (!selected || !canSave || busy) return;
    setBusy(true);
    setMessage(null);
    const result = await saveEditorPattern({
      name: name.trim() || nodeLabel(selected),
      category: "My patterns",
      tags: [],
      node: selected,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSaved((current) => [result.pattern, ...current]);
    setName("");
    setMessage("Saved for this team.");
  }

  async function remove(id: string) {
    const result = await deleteEditorPattern(id);
    if (result.ok) setSaved((current) => current.filter((item) => item.id !== id));
    else setMessage(result.message ?? "That pattern could not be deleted.");
  }

  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="rounded-input border border-border bg-surface-muted p-2">
        <p className="text-xs font-semibold text-text">Save what you selected</p>
        {canSave ? (
          <>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={selected ? nodeLabel(selected) : "Pattern name"}
              className="mt-2 h-8 w-full rounded-input border border-border bg-surface px-2 text-xs text-text outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="mt-2 h-8 w-full rounded-input border border-border bg-surface text-xs font-semibold text-text hover:bg-surface-muted disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save as pattern"}
            </button>
          </>
        ) : (
          <p className="mt-1 text-[11px] text-text-muted">Select a section or element on the page first.</p>
        )}
        {message ? <p className="mt-1 text-[11px] text-text-muted">{message}</p> : null}
      </div>

      <p className="mt-3 text-xs text-text-muted">
        Start with a whole page made of sections. You can change everything after adding it.
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cn(
              "h-7 rounded-full border px-2 text-[11px] font-semibold",
              category === item
                ? "border-primary bg-primary-soft text-text"
                : "border-border bg-surface text-text-muted hover:bg-surface-muted",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {savedState === "loading" ? (
          <div className="rounded-card border border-border bg-surface p-3 text-xs text-text-muted">Loading saved patterns…</div>
        ) : null}
        {saved.map((pattern) => (
          <div key={pattern.id} className="rounded-card border border-border bg-surface p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-text">{pattern.name}</span>
                <span className="block text-xs text-text-muted">
                  {pattern.category}
                  {pattern.usageCount > 0 ? ` · used ${pattern.usageCount} times` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void remove(pattern.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted hover:text-text"
                aria-label={`Delete ${pattern.name}`}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const copy = cloneNode(pattern.content);
                const checked = validateContentV5({
                  schemaVersion: 5,
                  root: { id: "page", type: "page", props: {}, children: [copy] },
                });
                const node = checked.ok ? checked.content.root.children?.[0] : undefined;
                if (!node) {
                  setMessage("That saved pattern can no longer be added.");
                  return;
                }
                insertNodesAt([node]);
                void recordEditorPatternUse(pattern.id);
              }}
              className="mt-2 h-8 w-full rounded-input bg-primary text-xs font-semibold text-on-primary"
            >
              Add to page
            </button>
          </div>
        ))}
        {patterns.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            onClick={() =>
              insertNodesAt(pattern.kinds.map((kind) => createNode("smart", defaultSmartProps(kind))))
            }
            className="block w-full rounded-card border border-border bg-surface p-2 text-left hover:border-primary hover:shadow-card"
          >
            <span className="flex h-24 flex-col gap-1 overflow-hidden rounded-input bg-surface-muted p-2">
              {pattern.kinds.map((kind, index) => (
                <span
                  key={`${pattern.id}-${kind}-${index}`}
                  className={cn(
                    "block rounded-sm",
                    kind === "hero" ? "h-8 bg-primary/30" : kind === "cta" ? "h-4 bg-accent/40" : "h-3 bg-border",
                  )}
                />
              ))}
            </span>
            <span className="mt-2 block text-sm font-semibold text-text">{pattern.label}</span>
            <span className="block text-xs text-text-muted">{pattern.description}</span>
          </button>
        ))}
        <p className="mt-3 text-xs text-text-muted">
          Want a whole design instead?{" "}
          <Link
            href={`/dashboard/projects/${projectId}/templates`}
            className="underline underline-offset-4 hover:text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Browse all templates
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function LayersTab({ root, count }: { root: ContentNode; count: number }) {
  const [open, setOpen] = React.useState<Set<string>>(() => new Set([root.id]));
  const selectedId = useEditorStore((state) => state.selectedId);
  const select = useEditorStore((state) => state.select);
  const moveSibling = useEditorStore((state) => state.moveSibling);
  const duplicate = useEditorStore((state) => state.duplicate);
  const remove = useEditorStore((state) => state.remove);
  const move = useEditorStore((state) => state.move);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const target = findNode(root, targetId);
    if (!target) return;
    if (targetId === root.id) {
      move(draggedId, root.id, (target.children?.length ?? 0));
      setDraggedId(null);
      return;
    }
    const parent = findParent(root, targetId);
    const from = findParent(root, draggedId);
    if (!parent) return;
    let index = parent.index;
    if (from && from.parent.id === parent.parent.id && from.index < parent.index) index -= 1;
    move(draggedId, parent.parent.id, index);
    setDraggedId(null);
  }

  const toggle = (id: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-auto p-2" role="tree" aria-label="Page layers">
        <LayerRow
          node={root}
          depth={0}
          open={open}
          toggle={toggle}
          selectedId={selectedId}
          select={select}
          moveSibling={moveSibling}
          duplicate={duplicate}
          remove={remove}
          draggedId={draggedId}
          setDraggedId={setDraggedId}
          onDrop={dropOn}
        />
      </div>
      <div className="border-t border-border px-3 py-2 text-xs text-text-muted">
        {count.toLocaleString()} of 2,000 elements
      </div>
    </div>
  );
}

function LayerRow({
  node,
  depth,
  open,
  toggle,
  selectedId,
  select,
  moveSibling,
  duplicate,
  remove,
  draggedId,
  setDraggedId,
  onDrop,
}: {
  node: ContentNode;
  depth: number;
  open: Set<string>;
  toggle: (id: string) => void;
  selectedId: string | null;
  select: (id: string) => void;
  moveSibling: (id: string, direction: -1 | 1) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onDrop: (id: string) => void;
}) {
  const children = node.children ?? [];
  const isOpen = open.has(node.id);
  const Icon = NODE_ICONS[node.type] ?? Box;
  const selected = selectedId === node.id;
  const isRoot = node.type === "page";
  const [over, setOver] = React.useState(false);

  return (
    <div role="treeitem" aria-expanded={children.length ? isOpen : undefined} aria-selected={selected}>
      <div
        className={cn(
          "group flex min-h-8 items-center gap-1 rounded-input pr-1 text-sm",
          selected ? "bg-primary-soft text-text" : "text-text hover:bg-surface-muted",
          over && draggedId !== node.id ? "ring-2 ring-primary" : "",
        )}
        style={{ paddingLeft: depth * 14 + 4 }}
        draggable={!isRoot}
        onDragStart={(event) => {
          if (isRoot) return;
          event.dataTransfer.setData("text/plain", node.id);
          event.dataTransfer.effectAllowed = "move";
          setDraggedId(node.id);
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setOver(false);
        }}
        onDragOver={(event) => {
          if (!draggedId || draggedId === node.id) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          onDrop(node.id);
        }}
      >
        {!isRoot ? (
          <GripVertical size={12} className="shrink-0 text-text-muted opacity-40 group-hover:opacity-100" aria-hidden />
        ) : null}
        {children.length > 0 ? (
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center text-text-muted"
            onClick={() => toggle(node.id)}
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => select(node.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
        >
          <Icon size={15} strokeWidth={1.7} className="shrink-0 text-text-muted" aria-hidden />
          <span className="truncate">{nodeLabel(node)}</span>
          {node.locked ? <Lock size={12} className="shrink-0 text-text-muted" aria-label="Locked" /> : null}
          {node.hidden?.all ? <EyeOff size={12} className="shrink-0 text-text-muted" aria-label="Hidden" /> : null}
        </button>
        {!isRoot ? (
          <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
            <IconButton label="Move up" onClick={() => moveSibling(node.id, -1)}>
              <ArrowUp size={13} />
            </IconButton>
            <IconButton label="Move down" onClick={() => moveSibling(node.id, 1)}>
              <ArrowDown size={13} />
            </IconButton>
            <IconButton label="Duplicate" onClick={() => duplicate(node.id)}>
              <Copy size={13} />
            </IconButton>
            <IconButton label="Delete" onClick={() => remove(node.id)}>
              <Trash2 size={13} />
            </IconButton>
          </span>
        ) : null}
      </div>
      {isOpen
        ? children.map((child) => (
            <LayerRow
              key={child.id}
              node={child}
              depth={depth + 1}
              open={open}
              toggle={toggle}
              selectedId={selectedId}
              select={select}
              moveSibling={moveSibling}
              duplicate={duplicate}
              remove={remove}
              draggedId={draggedId}
              setDraggedId={setDraggedId}
              onDrop={onDrop}
            />
          ))
        : null}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-text"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
