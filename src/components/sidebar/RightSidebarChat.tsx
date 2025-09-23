import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Copy, 
  RotateCcw, 
  Plus, 
  Settings, 
  PanelRightClose,
  Sparkles,
  MessageSquare,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIStore, ChatMessage } from '@/state/useAIStore';
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { useBoardStore } from '@/state/useBoardStore';
import { aiService } from '@/services/ai';

interface RightSidebarChatProps {
  width: number;
  onResize: (width: number) => void;
}

const quickActions = [
  { label: 'Summarize', command: '/summarize', icon: FileText },
  { label: 'Outline', command: '/outline', icon: FileText },
  { label: 'Rewrite', command: '/rewrite', icon: RotateCcw },
  { label: 'Todo', command: '/todo', icon: FileText },
];

export const RightSidebarChat: React.FC<RightSidebarChatProps> = ({ width, onResize }) => {
  const {
    rightSidebarOpen,
    currentInput,
    isGenerating,
    includeContext,
    setCurrentInput,
    addMessage,
    getChatHistory,
    clearChatHistory,
    setIsGenerating,
    setIncludeContext,
    toggleRightSidebar,
  } = useAIStore();

  const { getCurrentNote, workspace } = useWorkspaceStore();
  const { noteBoxes, selectedBoxId, editingBoxId, addNoteBox } = useBoardStore();

  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentNote = getCurrentNote();
  const chatHistory = currentNote ? getChatHistory(currentNote.id) : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, streamingMessage]);

  const handleSendMessage = async (message?: string) => {
    const input = message || currentInput.trim();
    if (!input || isGenerating) return;

    if (!currentNote) {
      alert('Please select a note first');
      return;
    }

    // Add user message
    addMessage(currentNote.id, { role: 'user', content: input });
    setCurrentInput('');
    setIsGenerating(true);
    setStreamingMessage('');

    try {
      // Prepare context
      const context = {
        note: currentNote,
        selectedBoxContent: selectedBoxId ? 
          noteBoxes.find(box => box.id === selectedBoxId)?.content
            .map(node => (node as any).children?.map((child: any) => child.text).join(' '))
            .join(' ') : undefined,
      };

      // Generate AI response
      const generator = aiService.generate({
        messages: [...chatHistory, { 
          id: 'temp', 
          role: 'user', 
          content: input, 
          timestamp: Date.now() 
        }],
        context,
        includeContext,
      });

      let fullResponse = '';
      for await (const chunk of generator) {
        fullResponse = chunk;
        setStreamingMessage(chunk);
      }

      // Add assistant message
      addMessage(currentNote.id, { role: 'assistant', content: fullResponse });
      setStreamingMessage('');
    } catch (error) {
      console.error('AI generation error:', error);
      addMessage(currentNote.id, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      });
      setStreamingMessage('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickAction = (command: string) => {
    setCurrentInput(command + ' ');
    textareaRef.current?.focus();
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleInsertToBox = (content: string) => {
    if (selectedBoxId && editingBoxId === selectedBoxId) {
      // Insert into currently editing box (this would need integration with the text editor)
      console.log('Insert to box:', content);
      // TODO: Integrate with Slate editor to insert at cursor
    } else {
      // Create new box with content
      const canvas = document.querySelector('[data-canvas="true"]');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        addNoteBox(centerX, centerY);
        // TODO: Set the content of the new box
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === 'Escape') {
      textareaRef.current?.blur();
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-card border-l border-border"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">AI Assistant</h3>
            {currentNote && (
              <p className="text-xs text-muted-foreground truncate">
                {currentNote.title}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => currentNote && clearChatHistory(currentNote.id)}
            className="h-7 w-7 p-0"
            title="Clear Chat"
            disabled={!currentNote || chatHistory.length === 0}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleRightSidebar}
            className="h-7 w-7 p-0"
            title="Close Sidebar"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Context Toggle */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <Label htmlFor="include-context" className="text-xs">Include Context</Label>
          <Switch
            id="include-context"
            checked={includeContext}
            onCheckedChange={setIncludeContext}
          />
        </div>
        {includeContext && (
          <p className="text-xs text-muted-foreground mt-1">
            AI can see note content and selected text
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-border">
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map(action => (
            <Button
              key={action.command}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.command)}
              className="h-8 text-xs justify-start"
              disabled={!currentNote}
            >
              <action.icon className="h-3 w-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-3">
        {!currentNote ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Select a note to start chatting</p>
          </div>
        ) : chatHistory.length === 0 && !streamingMessage ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Start a conversation</p>
            <p className="text-xs mt-1">Use quick actions or ask anything</p>
          </div>
        ) : (
          <div className="space-y-4">
            {chatHistory.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                onCopy={handleCopyMessage}
                onInsert={handleInsertToBox}
              />
            ))}
            {streamingMessage && (
              <ChatMessageBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingMessage,
                  timestamp: Date.now(),
                }}
                onCopy={handleCopyMessage}
                onInsert={handleInsertToBox}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder={currentNote ? "Ask me anything..." : "Select a note first..."}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating || !currentNote}
            className="flex-1 min-h-[60px] max-h-[120px] text-sm resize-none"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!currentInput.trim() || isGenerating || !currentNote}
            size="sm"
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Ctrl/⌘+Enter to send
        </p>
      </div>

      {/* Resize Handle */}
      <div 
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-border transition-colors"
        onMouseDown={(e) => {
          const startX = e.clientX;
          const startWidth = width;
          
          const handleMouseMove = (e: MouseEvent) => {
            const newWidth = startWidth - (e.clientX - startX);
            onResize(newWidth);
          };
          
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />
    </div>
  );
};

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onCopy: (content: string) => void;
  onInsert: (content: string) => void;
  isStreaming?: boolean;
}

const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ 
  message, 
  onCopy, 
  onInsert, 
  isStreaming = false 
}) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`
        max-w-[85%] rounded-lg p-3 text-sm
        ${isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted text-muted-foreground'
        }
        ${isStreaming ? 'animate-pulse' : ''}
      `}>
        <div className="whitespace-pre-wrap">{message.content}</div>
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/20">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(message.content)}
              className="h-6 px-2 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onInsert(message.content)}
              className="h-6 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Insert
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};