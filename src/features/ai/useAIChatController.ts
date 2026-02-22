import { useEffect, useMemo, useRef, useState } from "react";
import { produce } from "immer";
import { useAIStore, type ChatMessage } from "@/state/useAIStore";
import { useWorkspaceStore, type Workspace } from "@/state/useWorkspaceStore";
import { useBoardStore, type NoteBox } from "@/state/useBoardStore";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { aiClient } from "./aiClient";
import {
  extractSelectedBoxContent,
  formatToolSelectionMessage,
} from "./formatters";
import { trackAIEvent } from "./telemetry";
import type { FunctionResultChunk } from "@/services/ai";

type NoteApiResponse = {
  content?: unknown;
  title?: string;
  version?: number;
  zoom?: number;
  pan?: {
    x?: number;
    y?: number;
  } | null;
};

type MutationSnapshot = {
  noteId: string;
  title: string;
  boxes: NoteBox[];
};

const isBoxesWrapper = (value: unknown): value is { boxes: unknown[] } =>
  typeof value === "object" &&
  value !== null &&
  "boxes" in value &&
  Array.isArray((value as { boxes?: unknown[] }).boxes);

interface UseAIChatControllerOptions {
  onStreamingUpdate?: () => void;
}

const MUTATING_ACTIONS = new Set([
  "update_note_title",
  "add_box_to_note",
  "update_box_content",
]);

export const useAIChatController = ({
  onStreamingUpdate,
}: UseAIChatControllerOptions = {}) => {
  const {
    currentInput,
    isGenerating,
    includeContext,
    aiStatus,
    chatHistories,
    setCurrentInput,
    addMessage,
    clearChatHistory,
    setIsGenerating,
    setIncludeContext,
    setAiStatus,
    toggleRightSidebar,
  } = useAIStore();
  const { toast } = useToast();
  const { getCurrentNote, workspace } = useWorkspaceStore();
  const {
    noteBoxes,
    selectedBoxId,
    addNoteBox,
    replaceBoxContent,
    appendTextToBox,
    selectNoteBox,
    setEditingBox,
    loadNote,
    canvasTransform,
  } = useBoardStore();

  const [streamingMessage, setStreamingMessage] = useState("");
  const [pendingVersion, setPendingVersion] = useState<number | null>(null);
  const [isAwaitingSync, setIsAwaitingSync] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastMutationMessage, setLastMutationMessage] = useState<string | null>(
    null,
  );
  const lastMutationSnapshotRef = useRef<MutationSnapshot | null>(null);
  const fallbackRefreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const currentNote = getCurrentNote();
  const currentNoteVersion = currentNote?.version ?? null;
  const chatHistory = useMemo(
    () => (currentNote ? chatHistories[currentNote.id] || [] : []),
    [currentNote, chatHistories],
  );

  const contextualPrompts = useMemo(() => {
    if (!currentNote) return [];

    const selectedContent = extractSelectedBoxContent(noteBoxes, selectedBoxId);
    if (selectedContent && selectedContent.trim()) {
      return [
        "Summarize selected box",
        "Improve clarity of selected box",
        "Extract action items from selected box",
      ];
    }

    return [
      `Summarize "${currentNote.title}"`,
      `Create action plan for "${currentNote.title}"`,
      "Find missing details in this note",
    ];
  }, [currentNote, noteBoxes, selectedBoxId]);

  useEffect(() => {
    return () => {
      if (fallbackRefreshTimeout.current) {
        clearTimeout(fallbackRefreshTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAwaitingSync) {
      if (fallbackRefreshTimeout.current) {
        clearTimeout(fallbackRefreshTimeout.current);
        fallbackRefreshTimeout.current = null;
      }
      return;
    }
    if (pendingVersion === null) {
      return;
    }
    if (currentNoteVersion !== null && currentNoteVersion >= pendingVersion) {
      if (fallbackRefreshTimeout.current) {
        clearTimeout(fallbackRefreshTimeout.current);
        fallbackRefreshTimeout.current = null;
      }
      setIsAwaitingSync(false);
      setPendingVersion(null);
    }
  }, [isAwaitingSync, pendingVersion, currentNoteVersion]);

  const undoLastAIChange = async () => {
    const snapshot = lastMutationSnapshotRef.current;
    if (!snapshot) {
      return;
    }

    trackAIEvent("ai_undo_attempt", { noteId: snapshot.noteId });

    try {
      const latest = useWorkspaceStore.getState().getCurrentNote();
      const currentVersion = latest?.version ?? 1;
      const response = await apiService.updateNote(snapshot.noteId, {
        title: snapshot.title,
        content: snapshot.boxes,
        version: currentVersion,
      });
      const updated = await response.json();
      const collectionId =
        useWorkspaceStore.getState().workspace.active.collectionId;

      if (collectionId) {
        useWorkspaceStore.setState(
          produce((state: { workspace: Workspace }) => {
            const note =
              state.workspace.collections[collectionId]?.notes[snapshot.noteId];
            if (note) {
              note.title = snapshot.title;
              note.boxes = JSON.parse(JSON.stringify(snapshot.boxes));
              note.version = updated.version ?? note.version;
              note.updatedAt = Date.now();
            }
          }),
        );
      }

      loadNote(JSON.parse(JSON.stringify(snapshot.boxes)), {
        scale: canvasTransform.scale,
        x: canvasTransform.x,
        y: canvasTransform.y,
      });

      setLastMutationMessage(null);
      lastMutationSnapshotRef.current = null;
      trackAIEvent("ai_undo_success", { noteId: snapshot.noteId });
      toast({
        title: "AI change reverted",
        description: "The last AI-applied change has been undone.",
      });
    } catch (error) {
      trackAIEvent("ai_undo_failed", {
        noteId: snapshot.noteId,
        message: error instanceof Error ? error.message : String(error),
      });
      toast({
        variant: "destructive",
        title: "Undo failed",
        description:
          "Could not undo the AI change. Refresh the note and try again.",
      });
    }
  };

  const handleFunctionResult = async (
    chunk: FunctionResultChunk,
    noteId: string,
    noteVersion: number | undefined,
    setFullResponse: (value: string) => void,
  ) => {
    if (fallbackRefreshTimeout.current) {
      clearTimeout(fallbackRefreshTimeout.current);
      fallbackRefreshTimeout.current = null;
    }

    const payload =
      chunk.result && typeof chunk.result === "object"
        ? (chunk.result as Record<string, unknown>)
        : undefined;

    if (!payload) {
      console.warn("Chat: Missing payload in function result chunk");
      return;
    }

    const success = (payload.success as boolean | undefined) !== false;
    const message =
      typeof payload.message === "string" ? payload.message : undefined;
    const version =
      typeof payload.version === "number" ? payload.version : null;
    const action =
      typeof payload.action === "string" ? payload.action : undefined;

    trackAIEvent("ai_tool_result", {
      action: action || "unknown",
      success,
      hasVersion: version !== null,
    });

    const formatted = formatToolSelectionMessage(action, message, payload);
    if (formatted) {
      setStreamingMessage(formatted);
      setFullResponse(formatted);
    }

    if (success && action && MUTATING_ACTIONS.has(action)) {
      setLastMutationMessage(
        message || "AI applied changes to your note. You can undo them.",
      );
      toast({
        title: "AI changed your note",
        description: message || "Changes were applied successfully.",
      });
    }

    if (!success) {
      const err = message || "Unable to apply AI changes.";
      setLastError(err);
      toast({
        variant: "destructive",
        title: "AI action failed",
        description: err,
      });
      setPendingVersion(null);
      setIsAwaitingSync(false);
      return;
    }

    if (
      version !== null &&
      !(typeof noteVersion === "number" && noteVersion >= version)
    ) {
      setPendingVersion(version);
      setIsAwaitingSync(true);
      fallbackRefreshTimeout.current = setTimeout(async () => {
        try {
          const res = await apiService.getNote(noteId);
          const data = (await res.json()) as NoteApiResponse;
          const content = data.content;
          const boxesSource = Array.isArray(content)
            ? content
            : isBoxesWrapper(content)
              ? content.boxes
              : undefined;
          const clonedBoxes = Array.isArray(boxesSource)
            ? (JSON.parse(JSON.stringify(boxesSource)) as NoteBox[])
            : undefined;
          const pan = data.pan ?? {};

          if (clonedBoxes) {
            loadNote(clonedBoxes, {
              scale:
                typeof data.zoom === "number"
                  ? data.zoom
                  : canvasTransform.scale,
              x: typeof pan.x === "number" ? pan.x : canvasTransform.x,
              y: typeof pan.y === "number" ? pan.y : canvasTransform.y,
            });
          }

          const collectionId = workspace.active.collectionId;
          if (collectionId) {
            useWorkspaceStore.setState(
              produce((state: { workspace: Workspace }) => {
                const note =
                  state.workspace.collections[collectionId]?.notes[noteId];
                if (note) {
                  if (clonedBoxes) {
                    note.boxes = JSON.parse(JSON.stringify(clonedBoxes));
                  }
                  if (typeof data.title === "string") {
                    note.title = data.title;
                  }
                  if (typeof data.version === "number") {
                    note.version = data.version;
                  }
                  if (typeof data.zoom === "number") {
                    note.zoom = data.zoom;
                  }
                  if (data.pan && typeof data.pan === "object") {
                    note.pan = {
                      x:
                        typeof data.pan?.x === "number"
                          ? data.pan.x
                          : note.pan.x,
                      y:
                        typeof data.pan?.y === "number"
                          ? data.pan.y
                          : note.pan.y,
                    };
                  }
                }
              }),
            );
          }
        } catch (error) {
          console.error("Chat: Fallback refresh failed:", error);
        } finally {
          setIsAwaitingSync(false);
          setPendingVersion(null);
          fallbackRefreshTimeout.current = null;
        }
      }, 1500);
    } else {
      setPendingVersion(null);
      setIsAwaitingSync(false);
    }
  };

  const handleSendMessage = async (message?: string) => {
    const input = message || currentInput.trim();
    if (!input || isGenerating || !currentNote) {
      return;
    }

    setLastError(null);
    setLastMutationMessage(null);
    lastMutationSnapshotRef.current = {
      noteId: currentNote.id,
      title: currentNote.title,
      boxes: JSON.parse(JSON.stringify(noteBoxes)),
    };

    addMessage(currentNote.id, {
      role: "user",
      content: input,
    });
    setCurrentInput("");
    setIsGenerating(true);
    setStreamingMessage("");
    trackAIEvent("ai_message_sent", {
      noteId: currentNote.id,
      hasContext: includeContext,
      charCount: input.length,
    });

    try {
      const context = {
        note: currentNote,
        noteId: currentNote.id,
        collectionId: workspace.active.collectionId,
        selectedBoxContent: extractSelectedBoxContent(noteBoxes, selectedBoxId),
      };

      const messagesToSend: ChatMessage[] =
        chatHistory.length === 0
          ? [
              {
                id: "system",
                role: "system",
                content:
                  "Context: You are an AI assistant helping with note-taking. You can read note content, suggest edits, and when asked to make changes, you can format responses with commands like \"update title to 'New Title'\" or \"replace content with 'New Content'\" (when a box is selected).",
                timestamp: 0,
              },
              {
                id: "guard",
                role: "system",
                content: `Guidelines:
- DEFAULT: Answer in chat. Do not modify the note unless the user explicitly instructs you to create, update, or rename something.
- Only create boxes when the user clearly asks to add one.
- When the user asks to UPDATE an existing box, identify the correct box before acting.
- If you know the exact box id or title, include it in update_box_content.
- If you are unsure, call find_boxes first; if multiple matches are returned, call confirm_box_selection so the user can pick one.
- Do not create duplicate boxes when the user asked to update.
- Always confirm your changes once the function succeeds.`,
                timestamp: 0,
              },
              ...chatHistory,
              {
                id: "temp",
                role: "user",
                content: input,
                timestamp: Date.now(),
              },
            ]
          : [
              ...chatHistory,
              {
                id: "temp",
                role: "user",
                content: input,
                timestamp: Date.now(),
              },
            ];

      const generator = aiClient.generate({
        messages: messagesToSend,
        context,
        includeContext,
      });

      let fullResponse = "";
      const setFullResponse = (value: string) => {
        fullResponse = value;
      };

      for await (const chunk of generator) {
        if (typeof chunk !== "string") {
          if (chunk.type === "function_result") {
            await handleFunctionResult(
              chunk,
              currentNote.id,
              currentNote.version,
              setFullResponse,
            );
            onStreamingUpdate?.();
          }
          continue;
        }

        fullResponse = chunk;
        setStreamingMessage(chunk);
        onStreamingUpdate?.();
      }

      if (fullResponse.trim()) {
        addMessage(currentNote.id, {
          role: "assistant",
          content: fullResponse,
        });
      }

      setStreamingMessage("");
      setAiStatus("available");
      trackAIEvent("ai_stream_completed", {
        noteId: currentNote.id,
        responseChars: fullResponse.length,
      });
    } catch (error) {
      let errorMessage = "Sorry, I encountered an error. Please try again.";
      let errorCode = "AI_GENERATION_FAILED";
      let toastTitle = "AI Error";

      if (error instanceof Error) {
        if ("code" in error && typeof error.code === "string") {
          errorCode = error.code;
        }

        if (
          errorCode === "QUOTA_EXCEEDED" ||
          error.message.includes("429") ||
          error.message.includes("quota")
        ) {
          errorMessage =
            "AI service is temporarily unavailable due to usage limits. Please try again later or check your OpenAI account.";
          toastTitle = "Quota Exceeded";
        } else if (
          errorCode === "AUTHENTICATION_FAILED" ||
          error.message.includes("401") ||
          error.message.includes("unauthorized")
        ) {
          errorMessage =
            "AI service authentication failed. Please check the API configuration.";
          toastTitle = "Authentication Failed";
        } else if (
          errorCode === "RATE_LIMIT_EXCEEDED" ||
          error.message.includes("rate limit")
        ) {
          errorMessage =
            "AI service rate limit exceeded. Please try again in a few moments.";
          toastTitle = "Rate Limit Exceeded";
        } else if (
          errorCode === "NETWORK_ERROR" ||
          error.message.includes("network") ||
          error.message.includes("fetch") ||
          error.message.includes("Failed to fetch")
        ) {
          errorMessage =
            "Unable to connect to AI service. Please check your internet connection.";
          toastTitle = "Connection Error";
        } else {
          errorMessage =
            error.message.replace(/^AI service error: /i, "") || errorMessage;
        }
      }

      setLastError(errorMessage);
      setAiStatus("error");
      trackAIEvent("ai_stream_error", {
        noteId: currentNote.id,
        code: errorCode,
        message: errorMessage,
      });

      toast({
        variant: "destructive",
        title: toastTitle,
        description: errorMessage,
      });

      addMessage(currentNote.id, {
        role: "assistant",
        content: `⚠️ Error: ${errorMessage}`,
      });
      setStreamingMessage("");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickAction = (command: string) => {
    if (!currentNote || isGenerating) {
      return;
    }
    void handleSendMessage(command);
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleInsertToBox = (content: string) => {
    if (selectedBoxId) {
      appendTextToBox(selectedBoxId, content);
      selectNoteBox(selectedBoxId);
      setEditingBox(selectedBoxId);

      toast({
        title: "Content inserted",
        description: "AI content has been added to the selected note box.",
      });
      return;
    }

    const canvas = document.querySelector('[data-canvas="true"]');
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    addNoteBox(rect.width / 2, rect.height / 2);

    setTimeout(() => {
      const boxes = useBoardStore.getState().noteBoxes;
      const newBox = boxes[boxes.length - 1];
      if (newBox) {
        replaceBoxContent(newBox.id, content);
        selectNoteBox(newBox.id);
        setEditingBox(newBox.id);
      }
    }, 100);

    toast({
      title: "New box created",
      description: "A new note box with AI content has been created.",
    });
  };

  return {
    currentInput,
    isGenerating,
    includeContext,
    aiStatus,
    chatHistory,
    currentNote,
    streamingMessage,
    isAwaitingSync,
    lastError,
    lastMutationMessage,
    contextualPrompts,
    setCurrentInput,
    clearChatHistory,
    setIncludeContext,
    toggleRightSidebar,
    handleSendMessage,
    handleQuickAction,
    handleCopyMessage,
    handleInsertToBox,
    undoLastAIChange,
  };
};
