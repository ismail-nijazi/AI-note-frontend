import { useRef, useCallback, useEffect } from "react";
import { useBoardStore } from "@/state/useBoardStore";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";

interface UseCanvasAutoSaveProps {
  /**
   * The ID of the currently active note.
   * @type {string | null}
   */
  noteId: string | null;
  /**
   * The ID of the collection the active note belongs to.
   * @type {string | null}
   */
  collectionId: string | null;
}

/**
 * A custom React hook for managing auto-saving functionality of the canvas state.
 * It handles debounced saves on changes and periodic saves for unsaved changes,
 * syncing the note state to both local storage and the backend.
 *
 * @param {UseCanvasAutoSaveProps} props - The properties for the hook.
 * @param {string | null} props.noteId - The ID of the currently active note.
 * @param {string | null} props.collectionId - The ID of the collection the active note belongs to.
 *
 * @returns {void} This hook does not return any values.
 */
export const useCanvasAutoSave = ({
  noteId,
  collectionId,
}: UseCanvasAutoSaveProps) => {
  const { noteBoxes, canvasTransform, syncNoteToBackend, saveToStorage } =
    useBoardStore();
  const { getCurrentNote, updateNote, workspace } = useWorkspaceStore();

  // Track last saved snapshot to avoid redundant periodic saves
  const lastSavedHashRef = useRef<string | null>(null);

  const buildSnapshotHash = useCallback(() => {
    // Only include fields persisted to backend
    const boxes = noteBoxes.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      zIndex: b.zIndex,
      content: b.content,
    }));
    const payload = {
      boxes,
      zoom: canvasTransform.scale,
      pan: {
        x: canvasTransform.x,
        y: canvasTransform.y,
      },
    };
    return JSON.stringify(payload);
  }, [noteBoxes, canvasTransform]);

  const saveCurrentNoteNow = useCallback(async () => {
    const currentNote = getCurrentNote();
    if (currentNote && collectionId && noteId) {
      try {
        // Update local state only
        await updateNote(collectionId, noteId, {
          boxes: noteBoxes.map((box) => ({
            id: box.id,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            zIndex: box.zIndex,
            content: box.content,
          })),
          zoom: canvasTransform.scale,
          pan: {
            x: canvasTransform.x,
            y: canvasTransform.y,
          },
        });

        // Backend sync (skips when offline inside the hook)
        await syncNoteToBackend(noteId);

        // Update last saved hash on success
        lastSavedHashRef.current = buildSnapshotHash();
      } catch (error) {
        console.error("Failed to save note:", error);
      }
    }
  }, [
    getCurrentNote,
    collectionId,
    noteId,
    noteBoxes,
    canvasTransform,
    updateNote,
    syncNoteToBackend,
    buildSnapshotHash,
  ]);

  // Auto-save current note state (debounced on changes)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    // Debounce 1000ms after last change
    if (timeout) clearTimeout(timeout as unknown as number);
    timeout = setTimeout(saveCurrentNoteNow, 1000);

    return () => {
      if (timeout) clearTimeout(timeout as unknown as number);
    };
  }, [noteBoxes, canvasTransform, saveCurrentNoteNow]);

  // Periodic autosave every 15s if there are unsaved changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        typeof navigator !== "undefined" &&
        navigator &&
        navigator.onLine === false
      ) {
        return;
      }
      const currentHash = buildSnapshotHash();
      if (lastSavedHashRef.current !== currentHash) {
        void saveCurrentNoteNow();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [buildSnapshotHash, saveCurrentNoteNow]);

  return {}; // No direct return value needed for now
};
