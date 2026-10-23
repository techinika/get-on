import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type EditorContent = {
  schemaVersion: number;
  blocks: unknown[];
};

type EditorState = {
  content: EditorContent;
  selectedBlockId: string | null;
  device: 'phone' | 'tablet' | 'computer';
  panel: string | null;
  saveState: 'saved' | 'saving' | 'unsaved' | 'offline' | 'error';
  baseRevision: number;
  past: EditorContent[];
  future: EditorContent[];
  setContent: (content: EditorContent) => void;
  undo: () => void;
  redo: () => void;
};

function clone(content: EditorContent): EditorContent {
  return JSON.parse(JSON.stringify(content)) as EditorContent;
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    content: { schemaVersion: 3, blocks: [] },
    selectedBlockId: null,
    device: 'computer',
    panel: null,
    saveState: 'saved',
    baseRevision: 1,
    past: [],
    future: [],
    setContent: (content) =>
      set((state) => {
        state.past.push(clone(state.content));
        if (state.past.length > 100) state.past.shift();
        state.content = content;
        state.future = [];
      }),
    undo: () =>
      set((state) => {
        if (state.past.length === 0) return;
        const previous = state.past.pop()!;
        state.future.push(clone(state.content));
        state.content = previous;
      }),
    redo: () =>
      set((state) => {
        if (state.future.length === 0) return;
        const next = state.future.pop()!;
        state.past.push(clone(state.content));
        state.content = next;
      }),
  })),
);
