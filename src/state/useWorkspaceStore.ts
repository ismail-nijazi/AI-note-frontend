import { create } from 'zustand';
import { produce } from 'immer';
import { Descendant } from 'slate';

export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  content: Descendant[];
}

export interface Note {
  id: string;
  title: string;
  boxes: Box[];
  createdAt: number;
  updatedAt: number;
  zoom: number;
  pan: { x: number; y: number };
}

export interface Collection {
  id: string;
  title: string;
  noteOrder: string[];
  notes: Record<string, Note>;
}

export interface Workspace {
  collectionOrder: string[];
  collections: Record<string, Collection>;
  active: {
    collectionId: string | null;
    noteId: string | null;
  };
}

interface WorkspaceState {
  workspace: Workspace;
  leftSidebarOpen: boolean;
  leftSidebarWidth: number;
  searchQuery: string;
}

interface WorkspaceActions {
  // Sidebar management
  toggleLeftSidebar: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setSearchQuery: (query: string) => void;
  
  // Collection management
  createCollection: (title: string) => string;
  updateCollection: (id: string, updates: Partial<Omit<Collection, 'id' | 'notes'>>) => void;
  deleteCollection: (id: string) => void;
  reorderCollections: (newOrder: string[]) => void;
  
  // Note management
  createNote: (collectionId: string, title: string) => string;
  updateNote: (collectionId: string, noteId: string, updates: Partial<Omit<Note, 'id'>>) => void;
  deleteNote: (collectionId: string, noteId: string) => void;
  reorderNotes: (collectionId: string, newOrder: string[]) => void;
  duplicateNote: (collectionId: string, noteId: string) => string;
  
  // Active note management
  setActiveNote: (collectionId: string | null, noteId: string | null) => void;
  getCurrentNote: () => Note | null;
  
  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;
  exportWorkspace: () => string;
  importWorkspace: (data: string) => void;
}

const initialWorkspace: Workspace = {
  collectionOrder: [],
  collections: {},
  active: {
    collectionId: null,
    noteId: null,
  },
};

const initialState: WorkspaceState = {
  workspace: initialWorkspace,
  leftSidebarOpen: true,
  leftSidebarWidth: 280,
  searchQuery: '',
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set, get) => ({
  ...initialState,

  toggleLeftSidebar: () => {
    set(produce((state: WorkspaceState) => {
      state.leftSidebarOpen = !state.leftSidebarOpen;
    }));
    get().saveToStorage();
  },

  setLeftSidebarWidth: (width: number) => {
    const clampedWidth = Math.max(220, Math.min(380, width));
    set(produce((state: WorkspaceState) => {
      state.leftSidebarWidth = clampedWidth;
    }));
    get().saveToStorage();
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  createCollection: (title: string) => {
    const id = Date.now().toString();
    set(produce((state: WorkspaceState) => {
      state.workspace.collections[id] = {
        id,
        title,
        noteOrder: [],
        notes: {},
      };
      state.workspace.collectionOrder.push(id);
    }));
    get().saveToStorage();
    return id;
  },

  updateCollection: (id: string, updates: Partial<Omit<Collection, 'id' | 'notes'>>) => {
    set(produce((state: WorkspaceState) => {
      const collection = state.workspace.collections[id];
      if (collection) {
        Object.assign(collection, updates);
      }
    }));
    get().saveToStorage();
  },

  deleteCollection: (id: string) => {
    set(produce((state: WorkspaceState) => {
      delete state.workspace.collections[id];
      state.workspace.collectionOrder = state.workspace.collectionOrder.filter(cId => cId !== id);
      
      // Clear active if this collection was active
      if (state.workspace.active.collectionId === id) {
        state.workspace.active.collectionId = null;
        state.workspace.active.noteId = null;
      }
    }));
    get().saveToStorage();
  },

  reorderCollections: (newOrder: string[]) => {
    set(produce((state: WorkspaceState) => {
      state.workspace.collectionOrder = newOrder;
    }));
    get().saveToStorage();
  },

  createNote: (collectionId: string, title: string) => {
    const id = Date.now().toString();
    const now = Date.now();
    set(produce((state: WorkspaceState) => {
      const collection = state.workspace.collections[collectionId];
      if (collection) {
        collection.notes[id] = {
          id,
          title,
          boxes: [],
          createdAt: now,
          updatedAt: now,
          zoom: 1,
          pan: { x: 0, y: 0 },
        };
        collection.noteOrder.push(id);
      }
    }));
    get().saveToStorage();
    return id;
  },

  updateNote: (collectionId: string, noteId: string, updates: Partial<Omit<Note, 'id'>>) => {
    set(produce((state: WorkspaceState) => {
      const note = state.workspace.collections[collectionId]?.notes[noteId];
      if (note) {
        Object.assign(note, { ...updates, updatedAt: Date.now() });
      }
    }));
    get().saveToStorage();
  },

  deleteNote: (collectionId: string, noteId: string) => {
    set(produce((state: WorkspaceState) => {
      const collection = state.workspace.collections[collectionId];
      if (collection) {
        delete collection.notes[noteId];
        collection.noteOrder = collection.noteOrder.filter(nId => nId !== noteId);
        
        // Clear active if this note was active
        if (state.workspace.active.noteId === noteId) {
          state.workspace.active.noteId = null;
        }
      }
    }));
    get().saveToStorage();
  },

  reorderNotes: (collectionId: string, newOrder: string[]) => {
    set(produce((state: WorkspaceState) => {
      const collection = state.workspace.collections[collectionId];
      if (collection) {
        collection.noteOrder = newOrder;
      }
    }));
    get().saveToStorage();
  },

  duplicateNote: (collectionId: string, noteId: string) => {
    const newId = Date.now().toString();
    set(produce((state: WorkspaceState) => {
      const collection = state.workspace.collections[collectionId];
      const originalNote = collection?.notes[noteId];
      if (collection && originalNote) {
        const duplicatedNote: Note = {
          ...JSON.parse(JSON.stringify(originalNote)),
          id: newId,
          title: `${originalNote.title} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        collection.notes[newId] = duplicatedNote;
        const originalIndex = collection.noteOrder.indexOf(noteId);
        collection.noteOrder.splice(originalIndex + 1, 0, newId);
      }
    }));
    get().saveToStorage();
    return newId;
  },

  setActiveNote: (collectionId: string | null, noteId: string | null) => {
    set(produce((state: WorkspaceState) => {
      state.workspace.active.collectionId = collectionId;
      state.workspace.active.noteId = noteId;
    }));
    get().saveToStorage();
  },

  getCurrentNote: () => {
    const { workspace } = get();
    const { collectionId, noteId } = workspace.active;
    if (!collectionId || !noteId) return null;
    return workspace.collections[collectionId]?.notes[noteId] || null;
  },

  loadFromStorage: () => {
    try {
      const saved = localStorage.getItem('whiteboard.workspace.v1');
      if (saved) {
        const parsedState = JSON.parse(saved);
        set(produce((state: WorkspaceState) => {
          Object.assign(state, parsedState);
        }));
      }
    } catch (error) {
      console.error('Failed to load workspace from storage:', error);
    }
  },

  saveToStorage: () => {
    try {
      const state = get();
      localStorage.setItem('whiteboard.workspace.v1', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save workspace to storage:', error);
    }
  },

  exportWorkspace: () => {
    const { workspace } = get();
    return JSON.stringify(workspace, null, 2);
  },

  importWorkspace: (data: string) => {
    try {
      const importedWorkspace = JSON.parse(data);
      set(produce((state: WorkspaceState) => {
        state.workspace = importedWorkspace;
      }));
      get().saveToStorage();
    } catch (error) {
      console.error('Failed to import workspace:', error);
      throw new Error('Invalid workspace data');
    }
  },
}));