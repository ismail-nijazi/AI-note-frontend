import React, { useEffect, useRef } from "react";
import { ChatHeader } from "./right-sidebar-chat/ChatHeader";
import { ContextToggle } from "./right-sidebar-chat/ContextToggle";
import {
  QuickActions,
  DEFAULT_QUICK_ACTIONS,
} from "./right-sidebar-chat/QuickActions";
import { SyncNotice } from "./right-sidebar-chat/SyncNotice";
import { ChatMessages } from "./right-sidebar-chat/ChatMessages";
import { MessageInput } from "./right-sidebar-chat/MessageInput";
import { ContextPrompts } from "./right-sidebar-chat/ContextPrompts";
import { useAIChatController } from "@/features/ai/useAIChatController";
import { Button } from "@/components/ui/button";

interface RightSidebarChatProps {
  width: number;
  onResize: (width: number) => void;
}

export const RightSidebarChat: React.FC<RightSidebarChatProps> = ({
  width,
  onResize,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    const root = scrollContainerRef.current;
    if (!root) return;

    const viewport =
      (root.querySelector('[style*="overflow"]') as HTMLElement) ||
      (root.firstElementChild as HTMLElement);

    if (viewport && viewport.scrollHeight > viewport.clientHeight) {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }

    if (!messagesEndRef.current) {
      return;
    }

    let parent = messagesEndRef.current.parentElement;
    while (parent && parent !== root) {
      if (parent.scrollHeight > parent.clientHeight) {
        parent.scrollTop = parent.scrollHeight;
        break;
      }
      parent = parent.parentElement;
    }
  };

  const {
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
  } = useAIChatController({
    onStreamingUpdate: () => requestAnimationFrame(scrollToBottom),
  });

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, streamingMessage]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 168;
    const minHeight = 60;

    if (scrollHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
      textarea.style.overflowY = "hidden";
    }
  }, [currentInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && currentInput.trim() && currentNote) {
        void handleSendMessage();
      }
    }

    if (e.key === "Escape") {
      textareaRef.current?.blur();
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-card border-l border-border"
      style={{ width }}
    >
      <ChatHeader
        aiStatus={aiStatus}
        noteTitle={currentNote?.title}
        canClear={!!currentNote && chatHistory.length > 0}
        onClear={
          currentNote ? () => clearChatHistory(currentNote.id) : undefined
        }
        onToggleSidebar={toggleRightSidebar}
      />

      <ContextToggle
        includeContext={includeContext}
        onToggle={setIncludeContext}
      />

      <QuickActions
        actions={DEFAULT_QUICK_ACTIONS}
        disabled={!currentNote || isGenerating}
        onSelect={handleQuickAction}
      />

      <ContextPrompts
        prompts={contextualPrompts}
        disabled={!currentNote || isGenerating}
        onSelect={handleSendMessage}
      />

      {isAwaitingSync && <SyncNotice />}
      {lastMutationMessage && (
        <div className="px-3 py-2 text-xs border-b border-border bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span>{lastMutationMessage}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={undoLastAIChange}
          >
            Undo
          </Button>
        </div>
      )}

      <ChatMessages
        hasActiveNote={!!currentNote}
        chatHistory={chatHistory}
        streamingMessage={streamingMessage}
        isGenerating={isGenerating}
        aiStatus={aiStatus}
        errorMessage={lastError}
        onCopy={handleCopyMessage}
        onInsert={handleInsertToBox}
        messagesEndRef={messagesEndRef}
        scrollContainerRef={scrollContainerRef}
      />

      <MessageInput
        value={currentInput}
        onChange={setCurrentInput}
        onSend={handleSendMessage}
        onKeyDown={handleKeyDown}
        isGenerating={isGenerating}
        enabled={!!currentNote}
        textareaRef={textareaRef}
      />

      <div
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-border transition-colors"
        onMouseDown={(e) => {
          const startX = e.clientX;
          const startWidth = width;

          const handleMouseMove = (event: MouseEvent) => {
            const newWidth = startWidth - (event.clientX - startX);
            onResize(newWidth);
          };

          const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };

          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      />
    </div>
  );
};
