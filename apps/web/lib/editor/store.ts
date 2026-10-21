import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type EditorState = {
  content: any;
  selectedBlockId: string | null;
  device: 'phone' | 'tablet' | 'computer';
  panel: string | null;
  saveState: 'saved' | 'saving' | 'unsaved' | 'offline' | 'error';
  baseRevision: number;
  past: any[];
  future: any[];
  setContent: (content: any) => void;
  undo: () => void;
  redo: () => void;
};

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    content: { schemaVersion: 2, blocks: [] },
    selectedBlockId: null,
    device: 'computer',
    panel: null,
    saveState: 'saved',
    baseRevision: 1,
    past: [],
    future: [],
    setContent: (content) =>
      set((state) => {
        state.past.push(JSON.parse(JSON.stringify(state.content)));
        if (state.past.length > 100) state.past.shift();
        state.content = content;
        state.future = [];
      }),
    undo: () =>
      set((state) => {
        if (state.past.length === 0) return;
        const previous = state.past.pop()!;
        state.future.push(JSON.parse(JSON.stringify(state.content)));
        state.content = previous;
      }),
    redo: () =>
      set((state) => {
        if (state.future.length === 0) return;
        const next = state.future.pop()!;
        state.past.push(JSON.parse(JSON.stringify(state.content)));
        state.content = next;
      }),
  })),
);
