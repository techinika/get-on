"use client";

import { create } from "zustand";
import {
  acceptsChild,
  cloneNode,
  countNodes,
  createNode,
  defaultSmartProps,
  duplicateNode,
  findNode,
  findParent,
  insertNode,
  isContainerType,
  moveNode,
  removeNode,
  replaceNode,
  type ContentNode,
  type Declarations,
  type NodeType,
  type PageContentV5,
  type StyleSet,
} from "@get-on/blocks";

export type Device = "computer" | "tablet" | "phone";
export type StateKey = keyof StyleSet;
export type SaveState = "saved" | "unsaved" | "saving" | "offline" | "error";
export type EditorMode = "edit" | "preview";
export type LeftTab = "add" | "layers";
export type Zoom = "fit" | number;

type CommitOptions = { history?: boolean; group?: string };

type EditorState = {
  content: PageContentV5;
  savedContent: PageContentV5;
  selectedId: string | null;
  hoveredId: string | null;
  editingId: string | null;
  device: Device;
  stateKey: StateKey;
  width: number;
  zoom: Zoom;
  mode: EditorMode;
  leftTab: LeftTab;
  leftOpen: boolean;
  rightOpen: boolean;
  saveState: SaveState;
  revision: number;
  past: PageContentV5[];
  future: PageContentV5[];
  lastError: string | null;
  setContent: (next: PageContentV5, options?: CommitOptions) => void;
  updateNode: (id: string, patch: Partial<ContentNode>, options?: CommitOptions) => void;
  updateProps: (id: string, props: Record<string, unknown>, options?: CommitOptions) => void;
  updateStyles: (id: string, device: StateKey, prop: string, value: string | null, options?: CommitOptions) => void;
  insert: (type: NodeType, props?: Record<string, unknown>) => string | null;
  insertSmart: (kind: string) => string | null;
  insertNodeAt: (node: ContentNode, parentId?: string, index?: number) => string | null;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  move: (id: string, parentId: string, index?: number) => void;
  moveSibling: (id: string, direction: -1 | 1) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  setDevice: (device: Device) => void;
  setWidth: (width: number) => void;
  setZoom: (zoom: Zoom) => void;
  setMode: (mode: EditorMode) => void;
  setLeftTab: (tab: LeftTab) => void;
  toggleLeft: (open?: boolean) => void;
  toggleRight: (open?: boolean) => void;
  setStateKey: (key: StateKey) => void;
  undo: () => void;
  redo: () => void;
  setSaveState: (state: SaveState, error?: string | null) => void;
  markSaved: (content: PageContentV5, revision: number) => void;
  nodeCount: () => number;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function setProps(node: ContentNode, patch: Record<string, unknown>): ContentNode {
  return { ...node, props: { ...(node.props ?? {}), ...patch } };
}

function clearEmpty(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function targetFor(root: ContentNode, selectedId: string | null, type: NodeType): { parentId: string; index?: number } {
  if (type === "section") return { parentId: root.id };
  if (selectedId) {
    const selected = findNode(root, selectedId);
    if (selected && isContainerType(selected.type) && selected.type !== "page" && (selected.children?.length ?? 0) === 0) {
      const candidate = createNode(type);
      if (acceptsChild(selected, candidate)) return { parentId: selected.id };
    }
    const parent = findParent(root, selectedId);
    if (parent) return { parentId: parent.parent.id, index: parent.index + 1 };
  }
  return { parentId: root.id };
}

let lastGroup = "";
let lastGroupAt = 0;

export const useEditorStore = create<EditorState>()((set, get) => {
  function commit(next: PageContentV5, options: CommitOptions = {}) {
    const state = get();
    if (next === state.content) return;
    const history = options.history !== false;
    const now = Date.now();
    const merge = history && options.group != null && options.group === lastGroup && now - lastGroupAt < 800;
    lastGroup = options.group ?? "";
    lastGroupAt = now;
    set({
      content: next,
      past: history && !merge ? [...state.past, state.content].slice(-100) : state.past,
      future: history ? [] : state.future,
      saveState: "unsaved",
      lastError: null,
    });
  }

  function mutate(id: string, fn: (node: ContentNode) => ContentNode, options?: CommitOptions) {
    const state = get();
    const node = findNode(state.content.root, id);
    if (!node) return;
    commit({ ...state.content, root: replaceNode(state.content.root, id, fn(node)) }, options);
  }

  return {
    content: { schemaVersion: 5, root: { id: "page", type: "page", props: {}, children: [] } },
    savedContent: { schemaVersion: 5, root: { id: "page", type: "page", props: {}, children: [] } },
    selectedId: "page",
    hoveredId: null,
    editingId: null,
    device: "computer",
    stateKey: "base",
    width: 1280,
    zoom: "fit",
    mode: "edit",
    leftTab: "add",
    leftOpen: true,
    rightOpen: true,
    saveState: "saved",
    revision: 0,
    past: [],
    future: [],
    lastError: null,

    setContent: (next, options) => commit(next, options),

    updateNode: (id, patch, options) => mutate(id, (node) => ({ ...node, ...patch }), options),

    updateProps: (id, props, options) => mutate(id, (node) => setProps(node, props), options),

    updateStyles: (id, device, prop, value, options) =>
      mutate(
        id,
        (node) => {
          const styles: StyleSet = clone(node.styles ?? {});
          const declarations = { ...(styles[device] ?? {}) };
          if (value === null || value === "") delete declarations[prop];
          else declarations[prop] = value;
          const clean = clearEmpty(declarations) as Declarations | undefined;
          if (clean) styles[device] = clean;
          else delete styles[device];
          return { ...node, styles: clearEmpty(styles) as StyleSet | undefined };
        },
        options ?? { group: `style:${id}:${device}:${prop}` },
      ),

    insert: (type, props) => {
      const node = createNode(type, props);
      if (type === "section" && !node.props?.name) node.props = { ...node.props, name: "Section" };
      return get().insertNodeAt(node);
    },

    insertSmart: (kind) => {
      const node = createNode("smart", defaultSmartProps(kind));
      return get().insertNodeAt(node);
    },

    insertNodeAt: (node, parentId, index) => {
      const state = get();
      const target = parentId ? { parentId, index } : targetFor(state.content.root, state.selectedId, node.type);
      const parent = findNode(state.content.root, target.parentId);
      if (!parent || !acceptsChild(parent, node)) return null;
      const root = insertNode(state.content.root, target.parentId, node, target.index);
      commit({ ...state.content, root });
      set({ selectedId: node.id });
      return node.id;
    },

    remove: (id) => {
      const state = get();
      if (id === state.content.root.id) return;
      const node = findNode(state.content.root, id);
      if (!node || node.locked) return;
      const root = removeNode(state.content.root, id);
      commit({ ...state.content, root });
      set({ selectedId: state.selectedId === id ? root.id : state.selectedId });
    },

    duplicate: (id) => {
      const state = get();
      const node = findNode(state.content.root, id);
      if (!node || id === state.content.root.id) return;
      const root = duplicateNode(state.content.root, id);
      const parent = findParent(root, id);
      const copy = parent?.parent.children?.[parent.index + 1];
      commit({ ...state.content, root });
      if (copy) set({ selectedId: copy.id });
    },

    move: (id, parentId, index) => {
      const state = get();
      const root = moveNode(state.content.root, id, parentId, index);
      if (root === state.content.root) return;
      commit({ ...state.content, root });
    },

    moveSibling: (id, direction) => {
      const state = get();
      const found = findParent(state.content.root, id);
      if (!found) return;
      const siblings = found.parent.children ?? [];
      const nextIndex = found.index + direction;
      if (nextIndex < 0 || nextIndex >= siblings.length) return;
      const children = [...siblings];
      const [node] = children.splice(found.index, 1);
      if (!node) return;
      children.splice(nextIndex, 0, node);
      const root = replaceNode(state.content.root, found.parent.id, { ...found.parent, children });
      commit({ ...state.content, root });
    },

    select: (id) => set({ selectedId: id, editingId: null }),
    hover: (id) => set({ hoveredId: id }),
    setEditing: (id) => set({ editingId: id }),
    setDevice: (device) =>
      set({ device, width: device === "phone" ? 390 : device === "tablet" ? 768 : 1280 }),
    setWidth: (width) => set({ width: Math.max(320, Math.min(1920, width)) }),
    setZoom: (zoom) => set({ zoom }),
    setMode: (mode) => set({ mode, editingId: null }),
    setLeftTab: (leftTab) => set({ leftTab, leftOpen: true }),
    toggleLeft: (open) => set((state) => ({ leftOpen: open ?? !state.leftOpen })),
    toggleRight: (open) => set((state) => ({ rightOpen: open ?? !state.rightOpen })),
    setStateKey: (stateKey) => set({ stateKey }),

    undo: () => {
      const state = get();
      const previous = state.past[state.past.length - 1];
      if (!previous) return;
      set({
        content: previous,
        past: state.past.slice(0, -1),
        future: [state.content, ...state.future].slice(0, 100),
        saveState: "unsaved",
      });
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({
        content: next,
        past: [...state.past, state.content].slice(-100),
        future: state.future.slice(1),
        saveState: "unsaved",
      });
    },

    setSaveState: (saveState, lastError = null) => set({ saveState, lastError }),
    markSaved: (content, revision) => set({ savedContent: content, revision, saveState: "saved", lastError: null }),
    nodeCount: () => countNodes(get().content.root),
  };
});

export function selectedNode(state: EditorState): ContentNode | null {
  return state.selectedId ? findNode(state.content.root, state.selectedId) : null;
}

export function isDirty(state: EditorState): boolean {
  return state.saveState === "unsaved" || state.saveState === "error";
}

export function newNodeFromClipboard(node: ContentNode): ContentNode {
  return cloneNode(node);
}
