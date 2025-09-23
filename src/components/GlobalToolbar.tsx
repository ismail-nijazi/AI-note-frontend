import React from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Type, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Code2, 
  Link, 
  Image, 
  Undo2, 
  Redo2,
  Unlink,
  Menu,
  MessageSquare,
  User,
  Settings,
  LogOut,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useBoardStore } from '@/state/useBoardStore';

interface GlobalToolbarProps {
  onBold?: () => void;
  onItalic?: () => void;
  onUnderline?: () => void;
  onStrikethrough?: () => void;
  onFontSize?: (size: string) => void;
  onParagraph?: () => void;
  onBulletList?: () => void;
  onNumberList?: () => void;
  onQuote?: () => void;
  onCode?: () => void;
  onCodeBlock?: () => void;
  onLink?: () => void;
  onUnlink?: () => void;
  onImage?: () => void;
  isFormatActive?: (format: string) => boolean;
  getCurrentFontSize?: () => string;
  // Sidebar controls
  leftSidebarOpen?: boolean;
  rightSidebarOpen?: boolean;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
}

export const GlobalToolbar: React.FC<GlobalToolbarProps> = ({
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onFontSize,
  onParagraph,
  onBulletList,
  onNumberList,
  onQuote,
  onCode,
  onCodeBlock,
  onLink,
  onUnlink,
  onImage,
  isFormatActive = () => false,
  getCurrentFontSize = () => 'normal',
  leftSidebarOpen = true,
  rightSidebarOpen = true,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}) => {
  const { selectedBoxId, undo, redo, history, historyIndex } = useBoardStore();

  const hasActiveEditor = !!selectedBoxId;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="flex items-center gap-1 p-2 bg-card border-b border-border shadow-sm">
      {/* Left Sidebar Control */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleLeftSidebar}
        className="h-8 w-8 p-0"
        title={leftSidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        <Menu className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6" />
      {/* Text Formatting */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBold}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('bold') ? 'bg-accent' : ''}`}
          title="Bold (Ctrl/⌘+B)"
          onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onItalic}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('italic') ? 'bg-accent' : ''}`}
          title="Italic (Ctrl/⌘+I)"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnderline}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('underline') ? 'bg-accent' : ''}`}
          title="Underline (Ctrl/⌘+U)"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStrikethrough}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('strikethrough') ? 'bg-accent' : ''}`}
          title="Strikethrough"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Font Size and Block Types */}
      <div className="flex items-center gap-1">
        <Select
          value={getCurrentFontSize()}
          onValueChange={onFontSize}
          disabled={!hasActiveEditor}
        >
          <SelectTrigger 
            className="h-8 w-16 text-xs"
            onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
          >
            <SelectValue placeholder="14" />
          </SelectTrigger>
          <SelectContent>
            {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64].map(size => (
              <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={onParagraph}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('paragraph') ? 'bg-accent' : ''}`}
          title="Paragraph"
          onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
        >
          <Type className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Lists */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBulletList}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('bulleted-list') ? 'bg-accent' : ''}`}
          title="Bullet List"
          onMouseDown={(e) => e.preventDefault()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNumberList}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('numbered-list') ? 'bg-accent' : ''}`}
          title="Numbered List"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Special Blocks */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onQuote}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('block-quote') ? 'bg-accent' : ''}`}
          title="Quote"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCode}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('code') ? 'bg-accent' : ''}`}
          title="Inline Code"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCodeBlock}
          disabled={!hasActiveEditor}
          className={`h-8 w-8 p-0 ${isFormatActive('code-block') ? 'bg-accent' : ''}`}
          title="Code Block"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Code2 className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Links and Images */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLink}
          disabled={!hasActiveEditor}
          className="h-8 w-8 p-0"
          title="Add Link"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnlink}
          disabled={!hasActiveEditor}
          className="h-8 w-8 p-0"
          title="Remove Link"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Unlink className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onImage}
          disabled={!hasActiveEditor}
          className="h-8 w-8 p-0"
          title="Insert Image"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Image className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          className="h-8 w-8 p-0"
          title="Undo (Ctrl/⌘+Z)"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          className="h-8 w-8 p-0"
          title="Redo (Ctrl/⌘+Y)"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Spacer to push AI Chat and user profile to the right */}
      <div className="flex-1" />

      {/* AI Chat Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleRightSidebar}
        className="h-8 px-3 flex items-center gap-2"
        title={rightSidebarOpen ? "Hide AI chat" : "Show AI chat"}
        onMouseDown={(e) => e.preventDefault()}
      >
        <MessageSquare className="h-4 w-4" />
        <span className="text-sm">AI Chat</span>
      </Button>

      <Separator orientation="vertical" className="h-6 mx-2" />

      {/* User Profile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
            <Avatar className="h-7 w-7">
              <AvatarImage src="/placeholder.svg" alt="User" />
              <AvatarFallback className="text-xs">U</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover">
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => window.location.href = '/settings'}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <HelpCircle className="h-4 w-4 mr-2" />
            Help & Support
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};