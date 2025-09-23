import { create } from 'zustand';
import { produce } from 'immer';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface NoteChatHistory {
  noteId: string;
  messages: ChatMessage[];
}

interface AIState {
  rightSidebarOpen: boolean;
  rightSidebarWidth: number;
  chatHistories: Record<string, ChatMessage[]>; // noteId -> messages
  currentInput: string;
  isGenerating: boolean;
  includeContext: boolean;
}

interface AIActions {
  // Sidebar management
  toggleRightSidebar: () => void;
  setRightSidebarWidth: (width: number) => void;
  
  // Chat management
  setCurrentInput: (input: string) => void;
  addMessage: (noteId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  getChatHistory: (noteId: string) => ChatMessage[];
  clearChatHistory: (noteId: string) => void;
  setIsGenerating: (generating: boolean) => void;
  setIncludeContext: (include: boolean) => void;
  
  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

const initialState: AIState = {
  rightSidebarOpen: true,
  rightSidebarWidth: 320,
  chatHistories: {},
  currentInput: '',
  isGenerating: false,
  includeContext: true,
};

export const useAIStore = create<AIState & AIActions>((set, get) => ({
  ...initialState,

  toggleRightSidebar: () => {
    set(produce((state: AIState) => {
      state.rightSidebarOpen = !state.rightSidebarOpen;
    }));
    get().saveToStorage();
  },

  setRightSidebarWidth: (width: number) => {
    const clampedWidth = Math.max(280, Math.min(480, width));
    set(produce((state: AIState) => {
      state.rightSidebarWidth = clampedWidth;
    }));
    get().saveToStorage();
  },

  setCurrentInput: (input: string) => {
    set({ currentInput: input });
  },

  addMessage: (noteId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    set(produce((state: AIState) => {
      if (!state.chatHistories[noteId]) {
        state.chatHistories[noteId] = [];
      }
      state.chatHistories[noteId].push(newMessage);
    }));
    get().saveToStorage();
  },

  getChatHistory: (noteId: string) => {
    return get().chatHistories[noteId] || [];
  },

  clearChatHistory: (noteId: string) => {
    set(produce((state: AIState) => {
      delete state.chatHistories[noteId];
    }));
    get().saveToStorage();
  },

  setIsGenerating: (generating: boolean) => {
    set({ isGenerating: generating });
  },

  setIncludeContext: (include: boolean) => {
    set({ includeContext: include });
    get().saveToStorage();
  },

  loadFromStorage: () => {
    try {
      const saved = localStorage.getItem('whiteboard.ai.v1');
      if (saved) {
        const parsedState = JSON.parse(saved);
        set(produce((state: AIState) => {
          Object.assign(state, parsedState);
        }));
      }
    } catch (error) {
      console.error('Failed to load AI state from storage:', error);
    }
  },

  saveToStorage: () => {
    try {
      const state = get();
      // Don't save temporary UI state
      const { currentInput, isGenerating, ...persistentState } = state;
      localStorage.setItem('whiteboard.ai.v1', JSON.stringify(persistentState));
    } catch (error) {
      console.error('Failed to save AI state to storage:', error);
    }
  },
}));