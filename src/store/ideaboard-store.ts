// ProMarker Idea Board Store
// State for the canvas-based idea board: tools, zoom, grid, undo/redo, object locks.

import { create } from 'zustand';

export type IdeaBoardTool =
  | 'select'
  | 'pen'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'text'
  | 'eraser'
  | 'pan'
  | 'sticky'
  | 'lasso';

interface IdeaBoardStoreState {
  activeTool: IdeaBoardTool;
  zoom: number;
  showGrid: boolean;
  locked: Set<string>;
  undoStack: string[];
  redoStack: string[];

  // Actions
  setTool: (tool: IdeaBoardTool) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  lockObject: (id: string) => void;
  unlockObject: (id: string) => void;
  isLocked: (id: string) => boolean;
  pushUndo: (canvasState: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  clearHistory: () => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const MAX_UNDO_STEPS = 50;

export const useIdeaBoardStore = create<IdeaBoardStoreState>((set, get) => ({
  activeTool: 'select',
  zoom: 1,
  showGrid: true,
  locked: new Set<string>(),
  undoStack: [],
  redoStack: [],

  setTool: (tool) => set({ activeTool: tool }),

  setZoom: (zoom) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    set({ zoom: clamped });
  },

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  lockObject: (id) =>
    set((state) => {
      const next = new Set(state.locked);
      next.add(id);
      return { locked: next };
    }),

  unlockObject: (id) =>
    set((state) => {
      const next = new Set(state.locked);
      next.delete(id);
      return { locked: next };
    }),

  isLocked: (id) => get().locked.has(id),

  pushUndo: (canvasState) =>
    set((state) => {
      const stack = [...state.undoStack, canvasState];
      // Trim to max undo steps
      if (stack.length > MAX_UNDO_STEPS) {
        stack.shift();
      }
      return {
        undoStack: stack,
        // Clear redo stack when a new action is performed
        redoStack: [],
      };
    }),

  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return null;

    const stack = [...undoStack];
    const current = stack.pop()!;

    set({
      undoStack: stack,
      redoStack: [...redoStack, current],
    });

    // Return the state to restore (the one now on top of undo stack),
    // or null if undo stack is now empty (meaning restore to initial blank).
    return stack.length > 0 ? stack[stack.length - 1] : null;
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return null;

    const stack = [...redoStack];
    const stateToRestore = stack.pop()!;

    set({
      undoStack: [...undoStack, stateToRestore],
      redoStack: stack,
    });

    return stateToRestore;
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),
}));
