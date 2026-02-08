import React, { useRef, useState, useCallback, useEffect } from "react";
import { useBoardStore } from "@/state/useBoardStore";

/**
 * @typedef {Object} ToolbarCallbacks
 * @property {(...args: unknown[]) => void} [key: string] - Callback functions for toolbar actions.
 */

interface UseCanvasInteractionProps {
  canvasRef: React.RefObject<HTMLDivElement>;
  /**
   * Optional callback to notify parent component about changes in toolbar callbacks.
   * @type {(callbacks: Record<string, (...args: unknown[]) => void>) => void}
   */
  onToolbarCallbacksChange?: (
    callbacks: Record<string, (...args: unknown[]) => void>,
  ) => void;
}

/**
 * A custom React hook for managing canvas interactions such as panning, zooming,
 * adding new note boxes, and handling keyboard shortcuts for deletion.
 *
 * @param {UseCanvasInteractionProps} props - The properties for the hook.
 * @param {React.RefObject<HTMLDivElement>} props.canvasRef - A ref to the main canvas DOM element.
 * @param {function(Record<string, (...args: unknown[]) => void>): void} [props.onToolbarCallbacksChange] - Callback to update parent with toolbar actions.
 *
 * @returns {Object} An object containing interaction states and handlers.
 * @returns {boolean} return.isPanning - True if the canvas is currently being panned.
 * @returns {(e: React.MouseEvent) => void} return.handleDoubleClick - Event handler for double-click events on the canvas.
 * @returns {(e: React.MouseEvent) => void} return.handleMouseDown - Event handler for mouse-down events on the canvas.
 * @returns {(e: React.MouseEvent) => void} return.handleMouseMove - Event handler for mouse-move events on the canvas.
 * @returns {() => void} return.handleMouseUp - Event handler for mouse-up events on the canvas.
 * @returns {(e: React.WheelEvent) => void} return.handleWheel - Event handler for wheel events on the canvas (for zooming/panning).
 * @returns {(screenX: number, screenY: number) => {x: number, y: number}} return.screenToCanvas - Function to convert screen coordinates to canvas coordinates.
 */
export const useCanvasInteraction = ({
  canvasRef,
  onToolbarCallbacksChange,
}: UseCanvasInteractionProps) => {
  const {
    selectedBoxId,
    editingBoxId,
    canvasTransform,
    addNoteBox,
    selectNoteBox,
    setEditingBox,
    updateCanvasTransform,
  } = useBoardStore();

  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [toolbarCallbacks, setToolbarCallbacks] = useState<
    Record<string, (...args: unknown[]) => void>
  >({});

  // Notify parent when toolbar callbacks change
  useEffect(() => {
    if (onToolbarCallbacksChange) {
      onToolbarCallbacksChange(toolbarCallbacks);
    }
  }, [toolbarCallbacks, onToolbarCallbacksChange]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return { x: screenX, y: screenY };

      return {
        x:
          (screenX - canvasRect.left - canvasTransform.x) /
          canvasTransform.scale,
        y:
          (screenY - canvasRect.top - canvasTransform.y) /
          canvasTransform.scale,
      };
    },
    [canvasTransform, canvasRef],
  );

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
      setToolbarCallbacks({}); // This setter needs to be passed to NoteBox to update callbacks

      // Start panning when clicking on empty canvas
      setIsPanning(true);
      setLastPanPoint({
        x: e.clientX,
        y: e.clientY,
      });
      e.preventDefault();
    } else if (e.button === 0 && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      // Start panning with Ctrl/Cmd/Shift + left click (backup method)
      setIsPanning(true);
      setLastPanPoint({
        x: e.clientX,
        y: e.clientY,
      });
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

      setLastPanPoint({
        x: e.clientX,
        y: e.clientY,
      });
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
      const newScale = Math.max(
        0.25,
        Math.min(5, canvasTransform.scale * delta),
      );

      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleDiff = newScale - canvasTransform.scale;
        const newX =
          canvasTransform.x -
          (mouseX - canvasTransform.x) * (scaleDiff / canvasTransform.scale);
        const newY =
          canvasTransform.y -
          (mouseY - canvasTransform.y) * (scaleDiff / canvasTransform.scale);

        updateCanvasTransform({
          scale: newScale,
          x: newX,
          y: newY,
        });
      }
    }
  };

  const { noteBoxes } = useBoardStore(); // To get latest state for deletion logic
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          // Undo is handled by toolbar
        } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
          e.preventDefault();
          // Redo is handled by toolbar
        }
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedBoxId &&
        e.target === document.body
      ) {
        // Allow deletion via keyboard when a box is selected and no input is focused
        e.preventDefault();
        const noteBox = noteBoxes.find((box) => box.id === selectedBoxId);
        if (noteBox) {
          const first = noteBox.content[0] as unknown as {
            children?: Array<{
              text?: string;
            }>;
          };
          const firstText = first?.children?.[0]?.text;
          const hasContent =
            noteBox.content.length > 1 ||
            (typeof firstText === "string" && firstText !== "Start typing...");
          if (hasContent) {
            if (confirm("Delete this note box?")) {
              useBoardStore.getState().deleteNoteBox(selectedBoxId);
            }
          } else {
            useBoardStore.getState().deleteNoteBox(selectedBoxId);
          }
        }
      }
    },
    [selectedBoxId, noteBoxes],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    isPanning,
    handleDoubleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    screenToCanvas,
    toolbarCallbacks,
    setToolbarCallbacks,
  };
};
