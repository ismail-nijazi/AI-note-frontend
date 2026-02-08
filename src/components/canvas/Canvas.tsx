import React, { useRef, useEffect } from "react";
import { useBoardStore } from "@/state/useBoardStore";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";
import { useAIStore } from "@/state/useAIStore";
import { useCanvasInteraction } from "./useCanvasInteraction";
import { socketService } from "@/services/socket";
import { useCanvasAutoSave } from "./useCanvasAutoSave";
import { CanvasZoomDisplay } from "./CanvasZoomDisplay";
import { CanvasInstructionsOverlay } from "./CanvasInstructionsOverlay";
import { NoteBox } from "@/components/note-box/NoteBox";

type ToolbarCallbacks = Record<string, (...args: unknown[]) => void>;

interface CanvasProps {
  onToolbarCallbacksChange?: (callbacks: ToolbarCallbacks) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ onToolbarCallbacksChange }) => {
  const {
    noteBoxes,
    selectedBoxId,
    canvasTransform,
    loadFromStorage,
    selectNoteBox,
  } = useBoardStore();

  const { getCurrentNote, workspace } = useWorkspaceStore();
  const { rightSidebarOpen } = useAIStore();

  const canvasRef = useRef<HTMLDivElement>(null);

  const {
    isPanning,
    handleDoubleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    setToolbarCallbacks, // This is still needed to pass to NoteBox
  } = useCanvasInteraction({ canvasRef, onToolbarCallbacksChange });

  // Call useCanvasAutoSave hook
  useCanvasAutoSave({
    noteId: workspace.active.noteId,
    collectionId: workspace.active.collectionId,
  });

  const currentNote = getCurrentNote();

  // Load data on mount
  useEffect(() => {
    loadFromStorage();
    // Establish WS connection early
    socketService.connect();
    return () => {
      socketService.disconnect();
    };
  }, [loadFromStorage]);

  // Join WS room when note changes
  useEffect(() => {
    if (workspace.active.noteId) {
      socketService.joinNote(workspace.active.noteId);
    }
  }, [workspace.active.noteId]);

  return (
    <div
      ref={canvasRef}
      className="flex-1 relative overflow-hidden cursor-default bg-background"
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      data-canvas="true"
      style={{
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {noteBoxes.map((noteBox) => (
          <NoteBox
            key={noteBox.id}
            noteBox={noteBox}
            isSelected={selectedBoxId === noteBox.id}
            onSelect={() => selectNoteBox(noteBox.id)}
            onFormatChange={setToolbarCallbacks}
          />
        ))}
      </div>

      {/* Zoom percentage display */}
      <CanvasZoomDisplay scale={canvasTransform.scale} />

      {/* Instructions overlay */}
      <CanvasInstructionsOverlay
        currentNoteTitle={currentNote?.title}
        noteBoxesCount={noteBoxes.length}
      />
    </div>
  );
};
