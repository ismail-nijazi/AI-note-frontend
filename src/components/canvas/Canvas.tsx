import React, { useRef, useEffect, useMemo, useState } from "react";
import { useBoardStore } from "@/state/useBoardStore";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";
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
  const SURFACE_PADDING = 400;

  const {
    noteBoxes,
    selectedBoxId,
    editingBoxId,
    canvasTransform,
    loadFromStorage,
    selectNoteBox,
  } = useBoardStore();

  const { getCurrentNote, workspace } = useWorkspaceStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const previousOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });

  const {
    isPanning,
    handleDoubleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    setToolbarCallbacks, // This is still needed to pass to NoteBox
  } = useCanvasInteraction({ canvasRef, onToolbarCallbacksChange });

  // Call useCanvasAutoSave hook
  useCanvasAutoSave({
    noteId: workspace.active.noteId,
    collectionId: workspace.active.collectionId,
  });

  const currentNote = getCurrentNote();
  const activeBoxId = editingBoxId ?? selectedBoxId;
  const activeBox = activeBoxId
    ? noteBoxes.find((box) => box.id === activeBoxId) || null
    : null;

  const bounds = useMemo(() => {
    if (noteBoxes.length === 0) {
      return {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
    }

    return {
      minX: Math.min(...noteBoxes.map((box) => box.x)),
      maxX: Math.max(...noteBoxes.map((box) => box.x + box.width)),
      minY: Math.min(...noteBoxes.map((box) => box.y)),
      maxY: Math.max(...noteBoxes.map((box) => box.y + box.height)),
    };
  }, [noteBoxes]);

  const candidateMetrics = useMemo(() => {
    const viewportWidth = Math.max(1, viewportSize.width);
    const viewportHeight = Math.max(1, viewportSize.height);

    const transformedLeft =
      bounds.minX * canvasTransform.scale + canvasTransform.x;
    const transformedRight =
      bounds.maxX * canvasTransform.scale + canvasTransform.x;
    const transformedTop =
      bounds.minY * canvasTransform.scale + canvasTransform.y;
    const transformedBottom =
      bounds.maxY * canvasTransform.scale + canvasTransform.y;

    const maxAbsX = Math.max(
      Math.abs(transformedLeft),
      Math.abs(transformedRight),
      viewportWidth / 2,
    );
    const maxAbsY = Math.max(
      Math.abs(transformedTop),
      Math.abs(transformedBottom),
      viewportHeight / 2,
    );

    const surfaceWidth = Math.max(
      viewportWidth,
      Math.ceil(maxAbsX * 2 + SURFACE_PADDING * 2),
    );
    const surfaceHeight = Math.max(
      viewportHeight,
      Math.ceil(maxAbsY * 2 + SURFACE_PADDING * 2),
    );

    return {
      surfaceWidth,
      surfaceHeight,
      originX: Math.floor(surfaceWidth / 2),
      originY: Math.floor(surfaceHeight / 2),
      overflowX: surfaceWidth > viewportWidth + 1,
      overflowY: surfaceHeight > viewportHeight + 1,
    };
  }, [
    SURFACE_PADDING,
    bounds.maxX,
    bounds.maxY,
    bounds.minX,
    bounds.minY,
    canvasTransform.scale,
    canvasTransform.x,
    canvasTransform.y,
    viewportSize.height,
    viewportSize.width,
  ]);

  const activeOverflow = useMemo(() => {
    if (!activeBox) {
      return { x: false, y: false };
    }

    const left = activeBox.x * canvasTransform.scale + canvasTransform.x;
    const right =
      (activeBox.x + activeBox.width) * canvasTransform.scale +
      canvasTransform.x;
    const top = activeBox.y * canvasTransform.scale + canvasTransform.y;
    const bottom =
      (activeBox.y + activeBox.height) * canvasTransform.scale +
      canvasTransform.y;

    return {
      x: left < 0 || right > viewportSize.width,
      y: top < 0 || bottom > viewportSize.height,
    };
  }, [
    activeBox,
    canvasTransform.scale,
    canvasTransform.x,
    canvasTransform.y,
    viewportSize.height,
    viewportSize.width,
  ]);

  const showHorizontalScrollbar =
    candidateMetrics.overflowX || activeOverflow.x;
  const showVerticalScrollbar = candidateMetrics.overflowY || activeOverflow.y;
  const hasScrollableSurface = showHorizontalScrollbar || showVerticalScrollbar;

  const scrollMetrics = useMemo(() => {
    if (!hasScrollableSurface) {
      return {
        surfaceWidth: Math.max(1, viewportSize.width),
        surfaceHeight: Math.max(1, viewportSize.height),
        originX: 0,
        originY: 0,
      };
    }

    return {
      surfaceWidth: candidateMetrics.surfaceWidth,
      surfaceHeight: candidateMetrics.surfaceHeight,
      originX: candidateMetrics.originX,
      originY: candidateMetrics.originY,
    };
  }, [
    candidateMetrics,
    hasScrollableSurface,
    viewportSize.height,
    viewportSize.width,
  ]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }

    const syncViewport = () => {
      setViewportSize({
        width: canvasEl.clientWidth || 1,
        height: canvasEl.clientHeight || 1,
      });
    };

    syncViewport();
    const observer = new ResizeObserver(syncViewport);
    observer.observe(canvasEl);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }

    if (!hasScrollableSurface) {
      previousOriginRef.current = null;
      canvasEl.scrollLeft = 0;
      canvasEl.scrollTop = 0;
      setScrollOffset({ x: 0, y: 0 });
      return;
    }

    const previousOrigin = previousOriginRef.current;
    if (!previousOrigin) {
      canvasEl.scrollLeft = scrollMetrics.originX;
      canvasEl.scrollTop = scrollMetrics.originY;
    } else {
      canvasEl.scrollLeft += scrollMetrics.originX - previousOrigin.x;
      canvasEl.scrollTop += scrollMetrics.originY - previousOrigin.y;
    }

    previousOriginRef.current = {
      x: scrollMetrics.originX,
      y: scrollMetrics.originY,
    };
    setScrollOffset({
      x: canvasEl.scrollLeft,
      y: canvasEl.scrollTop,
    });
  }, [hasScrollableSurface, scrollMetrics.originX, scrollMetrics.originY]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }

    const handleScroll = () => {
      setScrollOffset({
        x: canvasEl.scrollLeft,
        y: canvasEl.scrollTop,
      });
    };

    handleScroll();
    canvasEl.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      canvasEl.removeEventListener("scroll", handleScroll);
    };
  }, []);

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
      data-canvas-origin-x={scrollMetrics.originX}
      data-canvas-origin-y={scrollMetrics.originY}
      className={`flex-1 relative cursor-default bg-background ${
        showHorizontalScrollbar ? "overflow-x-auto" : "overflow-x-hidden"
      } ${showVerticalScrollbar ? "overflow-y-auto" : "overflow-y-hidden"}`}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      data-canvas="true"
      style={{
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      <div
        data-canvas-surface="true"
        className="relative"
        style={{
          width: `${scrollMetrics.surfaceWidth}px`,
          height: `${scrollMetrics.surfaceHeight}px`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${scrollMetrics.originX + canvasTransform.x}px, ${
              scrollMetrics.originY + canvasTransform.y
            }px) scale(${canvasTransform.scale})`,
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
      </div>

      {/* Zoom percentage display */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          transform: `translate(${scrollOffset.x}px, ${scrollOffset.y}px)`,
        }}
      >
        <CanvasZoomDisplay scale={canvasTransform.scale} />
      </div>

      {/* Instructions overlay */}
      <CanvasInstructionsOverlay
        currentNoteTitle={currentNote?.title}
        noteBoxesCount={noteBoxes.length}
      />
    </div>
  );
};
