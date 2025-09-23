import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useBoardStore } from '@/state/useBoardStore';
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { useAIStore } from '@/state/useAIStore';
import { NoteBox } from './NoteBox';
import { GlobalToolbar } from './GlobalToolbar';

export const Canvas: React.FC = () => {
  const {
    noteBoxes,
    selectedBoxId,
    editingBoxId,
    canvasTransform,
    addNoteBox,
    selectNoteBox,
    setEditingBox,
    updateCanvasTransform,
    loadFromStorage,
    saveToStorage,
  } = useBoardStore();

  const { getCurrentNote, updateNote, workspace, leftSidebarOpen } = useWorkspaceStore();
  const { rightSidebarOpen } = useAIStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [toolbarCallbacks, setToolbarCallbacks] = useState<any>({});

  // Load data on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Auto-save current note state
  useEffect(() => {
    const saveCurrentNote = () => {
      const currentNote = getCurrentNote();
      if (currentNote && workspace.active.collectionId && workspace.active.noteId) {
        updateNote(workspace.active.collectionId, workspace.active.noteId, {
          boxes: noteBoxes.map(box => ({
            id: box.id,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            zIndex: box.zIndex,
            content: box.content,
          })),
          zoom: canvasTransform.scale,
          pan: { x: canvasTransform.x, y: canvasTransform.y },
        });
      }
    };

    const interval = setInterval(saveCurrentNote, 2000); // Save every 2 seconds
    return () => clearInterval(interval);
  }, [noteBoxes, canvasTransform, getCurrentNote, updateNote, workspace.active]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return { x: screenX, y: screenY };

    return {
      x: (screenX - canvasRect.left - canvasTransform.x) / canvasTransform.scale,
      y: (screenY - canvasRect.top - canvasTransform.y) / canvasTransform.scale,
    };
  }, [canvasTransform]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    addNoteBox(canvasPos.x, canvasPos.y);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.target === canvasRef.current) {
      // Clear selection and unfocus any editing text box when clicking on empty canvas
      selectNoteBox(null);
      setEditingBox(null);
      setToolbarCallbacks({});
      
      // Start panning when clicking on empty canvas
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (e.button === 0 && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      // Start panning with Ctrl/Cmd/Shift + left click (backup method)
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;

      updateCanvasTransform({
        x: canvasTransform.x + deltaX,
        y: canvasTransform.y + deltaY,
      });

      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // If a note box is editing, don't zoom - allow normal text scrolling
    if (editingBoxId) {
      return; // Let the text editor handle scrolling
    }

    // Always zoom with wheel, pan only when holding modifier keys
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      // Pan with modifier keys + wheel
      e.preventDefault();
      const deltaX = e.deltaX * 2;
      const deltaY = e.deltaY * 2;
      
      updateCanvasTransform({
        x: canvasTransform.x - deltaX,
        y: canvasTransform.y - deltaY,
      });
    } else {
      // Zoom without modifier keys
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.25, Math.min(5, canvasTransform.scale * delta));
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const scaleDiff = newScale - canvasTransform.scale;
        const newX = canvasTransform.x - (mouseX - canvasTransform.x) * (scaleDiff / canvasTransform.scale);
        const newY = canvasTransform.y - (mouseY - canvasTransform.y) * (scaleDiff / canvasTransform.scale);
        
        updateCanvasTransform({
          scale: newScale,
          x: newX,
          y: newY,
        });
      }
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey)) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        // Undo is handled by toolbar
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        // Redo is handled by toolbar
      }
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBoxId && e.target === document.body) {
      // Allow deletion via keyboard when a box is selected and no input is focused
      e.preventDefault();
      const noteBox = noteBoxes.find(box => box.id === selectedBoxId);
      if (noteBox) {
        const hasContent = noteBox.content.length > 1 || 
          (noteBox.content[0] as any)?.children?.[0]?.text !== 'Start typing...';
        if (hasContent) {
          if (confirm('Delete this note box?')) {
            useBoardStore.getState().deleteNoteBox(selectedBoxId);
          }
        } else {
          useBoardStore.getState().deleteNoteBox(selectedBoxId);
        }
      }
    }
  }, [selectedBoxId, noteBoxes]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentNote = getCurrentNote();

  return (
    <div className="flex flex-col h-full bg-background">
      <GlobalToolbar 
        {...toolbarCallbacks} 
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        onToggleLeftSidebar={() => useWorkspaceStore.getState().toggleLeftSidebar()}
        onToggleRightSidebar={() => useAIStore.getState().toggleRightSidebar()}
      />
      
      <div 
        ref={canvasRef}
        className="flex-1 relative overflow-hidden cursor-default"
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        data-canvas="true"
        style={{
          cursor: isPanning ? 'grabbing' : 'default',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
            transformOrigin: '0 0',
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
        <div className="absolute top-4 right-4 pointer-events-none">
          <div className="bg-background/80 backdrop-blur-sm border border-border rounded-md px-2 py-1">
            <span className="text-xs text-muted-foreground font-mono">
              {Math.round(canvasTransform.scale * 100)}%
            </span>
          </div>
        </div>
        
        {/* Instructions overlay */}
        {noteBoxes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground">
              <h2 className="text-2xl font-semibold mb-2">
                {currentNote ? `Note: ${currentNote.title}` : 'Welcome to Whiteboard Notes'}
              </h2>
              <p className="text-lg">Double-click anywhere to add a note box</p>
              <p className="text-sm mt-2">Scroll to zoom, drag to pan around</p>
              {!currentNote && (
                <p className="text-sm mt-4 text-primary">Create a collection and note from the left sidebar to get started</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};