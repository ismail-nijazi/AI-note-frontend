import { useEffect, useState } from "react";
import { Canvas } from "@/components/canvas/Canvas";
import { LeftSidebar } from "@/components/sidebar/LeftSidebar";
import { GlobalToolbar } from "@/components/GlobalToolbar";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";
import { useAIStore } from "@/state/useAIStore";
import { testBackendConnection } from "@/utils/testBackendConnection";
import { useNavigate, useParams } from "react-router-dom";
import { useBoardStore } from "@/state/useBoardStore";
import { apiService } from "@/services/api";
import type { Box } from "@/state/useWorkspaceStore";
import NoActiveNote from "./NoActiveNote";

interface ToolbarCallbacks {
  [key: string]: () => void;
}

const Whiteboard = () => {
  const [toolbarCallbacks, setToolbarCallbacks] = useState<ToolbarCallbacks>(
    {},
  );
  const navigate = useNavigate();
  const params = useParams();

  const {
    leftSidebarOpen,
    leftSidebarWidth,
    setLeftSidebarWidth,
    toggleLeftSidebar,
    loadFromStorage: loadWorkspace,
    loadFromBackend,
    setActiveNote,
    workspace,
    createCollection,
    createNote,
  } = useWorkspaceStore();

  const {
    rightSidebarOpen,
    toggleRightSidebar,
    loadFromStorage: loadAI,
  } = useAIStore();

  const { loadNote } = useBoardStore();

  const handleCreateNote = async () => {
    try {
      // Create a note in the first available collection
      const collectionId = Object.keys(workspace.collections)[0];
      if (collectionId) {
        const noteId = await createNote(collectionId, "New Note");
        // Navigate to the new note
        navigate(`/notes/${noteId}`);
      } else {
        // If no collections exist, create one first
        const newCollectionId = await createCollection("My Notes");
        const noteId = await createNote(newCollectionId, "New Note");
        navigate(`/notes/${noteId}`);
      }
    } catch (error) {
      console.error("Failed to create note:", error);
    }
  };

  const handleCreateCollection = async () => {
    const name = prompt("Collection name:");
    if (name?.trim()) {
      try {
        await createCollection(name.trim());
      } catch (error) {
        console.error("Failed to create collection:", error);
      }
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Test backend connection first
        const isBackendAvailable = await testBackendConnection();

        if (isBackendAvailable) {
          // Try to load from backend
          await loadFromBackend();
          console.log("✅ Loaded data from backend");
        } else {
          console.log(
            "⚠️ Backend not available, falling back to local storage",
          );
          loadWorkspace();
        }
      } catch (error) {
        console.log("⚠️ Backend not available, falling back to local storage");
        loadWorkspace();
      }
      loadAI();

      // After data is loaded, if URL has noteId, set it active
      const noteId = params.noteId;
      if (noteId) {
        // Find the collection containing this note
        const collections = useWorkspaceStore.getState().workspace.collections;
        for (const [collectionId, col] of Object.entries(collections)) {
          if (col.notes[noteId]) {
            setActiveNote(collectionId, noteId);
            // Fetch fresh content
            try {
              const res = await apiService.getNote(noteId);
              const data = await res.json();
              const n = col.notes[noteId];
              loadNote((data.content as Box[]) || [], {
                scale: n.zoom,
                x: n.pan.x,
                y: n.pan.y,
              });
            } catch (error) {
              console.error("Failed to load note:", error);
            }
            break;
          }
        }
      }
    };

    loadData();
  }, [
    loadFromBackend,
    loadWorkspace,
    loadAI,
    params.noteId,
    setActiveNote,
    loadNote,
  ]);

  // Keep URL in sync when active note changes
  useEffect(() => {
    const { noteId } = workspace.active;
    if (noteId) {
      navigate(`/notes/${noteId}`, {
        replace: true,
      });
    } else {
      // If no active note, navigate to /app
      navigate("/app", { replace: true });
    }
  }, [workspace.active, navigate]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "k") {
          e.preventDefault();
          const searchInput = document.querySelector(
            '[placeholder="Search notes..."]',
          ) as HTMLInputElement;
          searchInput?.focus();
        } else if (e.key === "/") {
          e.preventDefault();
          toggleRightSidebar();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleRightSidebar]);

  // Check if we have an active note
  const hasActiveNote = workspace.active.noteId;

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Global Toolbar - spans full width */}
      <GlobalToolbar
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        onToggleLeftSidebar={toggleLeftSidebar}
        onToggleRightSidebar={toggleRightSidebar}
        {...toolbarCallbacks}
      />

      {/* Body with sidebars and main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <div
          className={`transition-all duration-300 ease-out ${
            leftSidebarOpen ? "w-auto" : "w-0"
          } overflow-hidden`}
        >
          {leftSidebarOpen && (
            <LeftSidebar
              width={leftSidebarWidth}
              onResize={setLeftSidebarWidth}
            />
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {hasActiveNote ? (
            <Canvas onToolbarCallbacksChange={setToolbarCallbacks} />
          ) : (
            <NoActiveNote
              handleCreateNote={handleCreateNote}
              handleCreateCollection={handleCreateCollection}
            />
          )}
        </div>

        {/* Right Sidebar */}
        {/* <div
					className={`transition-all duration-300 ease-out ${
						rightSidebarOpen
							? "w-auto"
							: "w-0"
					} overflow-hidden`}>
					{rightSidebarOpen && (
						<RightSidebarChat
							width={
								rightSidebarWidth
							}
							onResize={
								setRightSidebarWidth
							}
						/>
					)}
				</div> */}
      </div>
    </div>
  );
};

export default Whiteboard;
