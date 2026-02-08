import React from "react";

interface CanvasInstructionsOverlayProps {
  currentNoteTitle?: string;
  noteBoxesCount: number;
}

export const CanvasInstructionsOverlay: React.FC<
  CanvasInstructionsOverlayProps
> = ({ currentNoteTitle, noteBoxesCount }) => {
  if (noteBoxesCount > 0) {
    return null; // Don't show overlay if there are note boxes
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center text-muted-foreground">
        <h2 className="text-2xl font-semibold mb-2">
          {currentNoteTitle
            ? `Note: ${currentNoteTitle}`
            : "Welcome to Whiteboard Notes"}
        </h2>
        <p className="text-lg">Double-click anywhere to add a note box</p>
        <p className="text-sm mt-2">Scroll to zoom, drag to pan around</p>
        {!currentNoteTitle && (
          <p className="text-sm mt-4 text-primary">
            Create a collection and note from the left sidebar to get started
          </p>
        )}
      </div>
    </div>
  );
};
