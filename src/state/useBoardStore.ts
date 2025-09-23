import { create } from 'zustand';
import { produce } from 'immer';
import { Descendant } from 'slate';

export interface NoteBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  content: Descendant[];
}

export interface BoardState {
  noteBoxes: NoteBox[];
  selectedBoxId: string | null;
  editingBoxId: string | null;
  canvasTransform: {
    x: number;
    y: number;
    scale: number;
  };
  history: BoardState[];
  historyIndex: number;
  maxHistory: number;
}

interface BoardActions {
  addNoteBox: (x: number, y: number) => void;
  updateNoteBox: (id: string, updates: Partial<NoteBox>) => void;
  deleteNoteBox: (id: string) => void;
  selectNoteBox: (id: string | null) => void;
  setEditingBox: (id: string | null) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  duplicateNoteBox: (id: string) => void;
  updateCanvasTransform: (transform: Partial<BoardState['canvasTransform']>) => void;
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

const defaultContent: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: 'Start typing...' }],
  } as any,
];

const initialState: BoardState = {
  noteBoxes: [],
  selectedBoxId: null,
  editingBoxId: null,
  canvasTransform: { x: 0, y: 0, scale: 1 },
  history: [],
  historyIndex: -1,
  maxHistory: 50,
};

export const useBoardStore = create<BoardState & BoardActions>((set, get) => ({
  ...initialState,

  addNoteBox: (x: number, y: number) => {
    const newBox: NoteBox = {
      id: Date.now().toString(),
      x,
      y,
      width: 300,
      height: 160,
      zIndex: Date.now(),
      content: [...defaultContent],
    };

    set(produce((state: BoardState) => {
      state.noteBoxes.push(newBox);
      state.selectedBoxId = newBox.id;
    }));
    
    get().saveToHistory();
    get().saveToStorage();
  },

  updateNoteBox: (id: string, updates: Partial<NoteBox>) => {
    set(produce((state: BoardState) => {
      const box = state.noteBoxes.find(box => box.id === id);
      if (box) {
        Object.assign(box, updates);
      }
    }));
    
    get().saveToStorage();
  },

  deleteNoteBox: (id: string) => {
    set(produce((state: BoardState) => {
      state.noteBoxes = state.noteBoxes.filter(box => box.id !== id);
      if (state.selectedBoxId === id) {
        state.selectedBoxId = null;
      }
    }));
    
    get().saveToHistory();
    get().saveToStorage();
  },

  selectNoteBox: (id: string | null) => {
    set({ selectedBoxId: id });
  },

  setEditingBox: (id: string | null) => {
    set({ editingBoxId: id });
  },

  bringToFront: (id: string) => {
    const maxZ = Math.max(...get().noteBoxes.map(box => box.zIndex));
    get().updateNoteBox(id, { zIndex: maxZ + 1 });
    get().saveToHistory();
  },

  sendToBack: (id: string) => {
    const minZ = Math.min(...get().noteBoxes.map(box => box.zIndex));
    get().updateNoteBox(id, { zIndex: minZ - 1 });
    get().saveToHistory();
  },

  duplicateNoteBox: (id: string) => {
    const box = get().noteBoxes.find(box => box.id === id);
    if (box) {
      const newBox: NoteBox = {
        ...box,
        id: Date.now().toString(),
        x: box.x + 20,
        y: box.y + 20,
        zIndex: Date.now(),
        content: JSON.parse(JSON.stringify(box.content)),
      };

      set(produce((state: BoardState) => {
        state.noteBoxes.push(newBox);
        state.selectedBoxId = newBox.id;
      }));
      
      get().saveToHistory();
      get().saveToStorage();
    }
  },

  updateCanvasTransform: (transform: Partial<BoardState['canvasTransform']>) => {
    set(produce((state: BoardState) => {
      Object.assign(state.canvasTransform, transform);
    }));
  },

  saveToHistory: () => {
    set(produce((state: BoardState) => {
      const currentState = {
        noteBoxes: JSON.parse(JSON.stringify(state.noteBoxes)),
        selectedBoxId: state.selectedBoxId,
        editingBoxId: state.editingBoxId,
        canvasTransform: { ...state.canvasTransform },
        history: [],
        historyIndex: -1,
        maxHistory: state.maxHistory,
      };

      // Remove any history after current index
      state.history = state.history.slice(0, state.historyIndex + 1);
      
      // Add current state to history
      state.history.push(currentState);
      
      // Limit history size
      if (state.history.length > state.maxHistory) {
        state.history = state.history.slice(-state.maxHistory);
      }
      
      state.historyIndex = state.history.length - 1;
    }));
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      set(produce((state: BoardState) => {
        state.noteBoxes = JSON.parse(JSON.stringify(previousState.noteBoxes));
        state.selectedBoxId = previousState.selectedBoxId;
        state.canvasTransform = { ...previousState.canvasTransform };
        state.historyIndex = historyIndex - 1;
      }));
      get().saveToStorage();
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      set(produce((state: BoardState) => {
        state.noteBoxes = JSON.parse(JSON.stringify(nextState.noteBoxes));
        state.selectedBoxId = nextState.selectedBoxId;
        state.canvasTransform = { ...nextState.canvasTransform };
        state.historyIndex = historyIndex + 1;
      }));
      get().saveToStorage();
    }
  },

  loadFromStorage: () => {
    try {
      const saved = localStorage.getItem('whiteboard-state');
      if (saved) {
        const parsedState = JSON.parse(saved);
        set(produce((state: BoardState) => {
          state.noteBoxes = parsedState.noteBoxes || [];
          state.canvasTransform = parsedState.canvasTransform || { x: 0, y: 0, scale: 1 };
          state.selectedBoxId = null;
        }));
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  },

  saveToStorage: () => {
    try {
      const { noteBoxes, canvasTransform } = get();
      const stateToSave = {
        noteBoxes,
        canvasTransform,
      };
      localStorage.setItem('whiteboard-state', JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  },
}));