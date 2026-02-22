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

type WheelInputEvent = {
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
};

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
      const canvasEl = canvasRef.current;
      const canvasRect = canvasEl?.getBoundingClientRect();
      if (!canvasRect) return { x: screenX, y: screenY };

      const scrollLeft = canvasEl?.scrollLeft ?? 0;
      const scrollTop = canvasEl?.scrollTop ?? 0;
      const originX = Number(canvasEl?.dataset?.canvasOriginX || 0);
      const originY = Number(canvasEl?.dataset?.canvasOriginY || 0);

      return {
        x:
          (screenX -
            canvasRect.left +
            scrollLeft -
            (originX + canvasTransform.x)) /
          canvasTransform.scale,
        y:
          (screenY -
            canvasRect.top +
            scrollTop -
            (originY + canvasTransform.y)) /
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
    const canvasEl = canvasRef.current;

    if (canvasEl) {
      const hasVerticalScrollbar = canvasEl.offsetWidth > canvasEl.clientWidth;
      const hasHorizontalScrollbar =
        canvasEl.offsetHeight > canvasEl.clientHeight;

      if (hasVerticalScrollbar || hasHorizontalScrollbar) {
        const rect = canvasEl.getBoundingClientRect();
        const onVerticalScrollbar =
          hasVerticalScrollbar && e.clientX >= rect.left + canvasEl.clientWidth;
        const onHorizontalScrollbar =
          hasHorizontalScrollbar &&
          e.clientY >= rect.top + canvasEl.clientHeight;

        if (onVerticalScrollbar || onHorizontalScrollbar) {
          return;
        }
      }
    }

    const target = e.target as HTMLElement;
    const clickedCanvasBackground =
      e.target === canvasRef.current ||
      target?.dataset?.canvasSurface === "true";

    if (e.button === 0 && clickedCanvasBackground) {
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

  const handleWheel = useCallback(
    (e: WheelInputEvent) => {
      const hasActiveNoteBox = !!editingBoxId || !!selectedBoxId;

      // Explicit zoom shortcut that should not trigger browser page zoom.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(
          0.25,
          Math.min(3, canvasTransform.scale * delta),
        );

        const rect = canvasRef.current?.getBoundingClientRect();
        const canvasEl = canvasRef.current;
        if (!rect || !canvasEl) {
          return;
        }

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const scrollLeft = canvasEl.scrollLeft;
        const scrollTop = canvasEl.scrollTop;
        const originX = Number(canvasEl.dataset.canvasOriginX || 0);
        const originY = Number(canvasEl.dataset.canvasOriginY || 0);
        const anchorX = mouseX + scrollLeft - originX;
        const anchorY = mouseY + scrollTop - originY;

        const scaleDiff = newScale - canvasTransform.scale;
        const newX =
          canvasTransform.x -
          (anchorX - canvasTransform.x) * (scaleDiff / canvasTransform.scale);
        const newY =
          canvasTransform.y -
          (anchorY - canvasTransform.y) * (scaleDiff / canvasTransform.scale);

        updateCanvasTransform({
          scale: newScale,
          x: newX,
          y: newY,
        });
        return;
      }

      // Active note box: let wheel drive native scrollbar movement.
      if (hasActiveNoteBox) {
        return;
      }

      // No active note box: wheel zooms.
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(
        0.25,
        Math.min(3, canvasTransform.scale * delta),
      );

      const rect = canvasRef.current?.getBoundingClientRect();
      const canvasEl = canvasRef.current;
      if (rect && canvasEl) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const scrollLeft = canvasEl.scrollLeft;
        const scrollTop = canvasEl.scrollTop;
        const originX = Number(canvasEl.dataset.canvasOriginX || 0);
        const originY = Number(canvasEl.dataset.canvasOriginY || 0);
        const anchorX = mouseX + scrollLeft - originX;
        const anchorY = mouseY + scrollTop - originY;

        const scaleDiff = newScale - canvasTransform.scale;
        const newX =
          canvasTransform.x -
          (anchorX - canvasTransform.x) * (scaleDiff / canvasTransform.scale);
        const newY =
          canvasTransform.y -
          (anchorY - canvasTransform.y) * (scaleDiff / canvasTransform.scale);

        updateCanvasTransform({
          scale: newScale,
          x: newX,
          y: newY,
        });
      }
    },
    [
      canvasRef,
      canvasTransform.scale,
      canvasTransform.x,
      canvasTransform.y,
      editingBoxId,
      selectedBoxId,
      updateCanvasTransform,
    ],
  );

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      handleWheel({
        deltaY: event.deltaY,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        clientX: event.clientX,
        clientY: event.clientY,
        preventDefault: () => {
          if (event.cancelable) {
            event.preventDefault();
          }
        },
      });
    };

    canvasEl.addEventListener("wheel", onWheel, {
      passive: false,
    });

    return () => {
      canvasEl.removeEventListener("wheel", onWheel);
    };
  }, [canvasRef, handleWheel]);

  const { noteBoxes } = useBoardStore(); // To get latest state for deletion logic
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        selectNoteBox(null);
        setEditingBox(null);
        setToolbarCallbacks({});
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          // Undo is handled by toolbar
        } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
          e.preventDefault();
          // Redo is handled by toolbar
        } else if (e.key === "0") {
          e.preventDefault();
          updateCanvasTransform({
            scale: 1,
            x: 0,
            y: 0,
          });
          selectNoteBox(null);
          setEditingBox(null);
          setToolbarCallbacks({});
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
    [
      noteBoxes,
      selectedBoxId,
      selectNoteBox,
      setEditingBox,
      updateCanvasTransform,
    ],
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
    screenToCanvas,
    toolbarCallbacks,
    setToolbarCallbacks,
  };
};
