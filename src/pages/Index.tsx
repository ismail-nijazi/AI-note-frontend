import React, { useEffect } from 'react';
import { Canvas } from '@/components/Canvas';
import { LeftSidebar } from '@/components/sidebar/LeftSidebar';
import { RightSidebarChat } from '@/components/sidebar/RightSidebarChat';
import { Button } from '@/components/ui/button';
import { PanelLeft, PanelRight } from 'lucide-react';
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { useAIStore } from '@/state/useAIStore';

const Index = () => {
  const {
    leftSidebarOpen,
    leftSidebarWidth,
    setLeftSidebarWidth,
    toggleLeftSidebar,
    loadFromStorage: loadWorkspace,
  } = useWorkspaceStore();

  const {
    rightSidebarOpen,
    rightSidebarWidth,
    setRightSidebarWidth,
    toggleRightSidebar,
    loadFromStorage: loadAI,
  } = useAIStore();

  // Load data on mount
  useEffect(() => {
    loadWorkspace();
    loadAI();
  }, [loadWorkspace, loadAI]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === 'k') {
          e.preventDefault();
          const searchInput = document.querySelector('[placeholder="Search notes..."]') as HTMLInputElement;
          searchInput?.focus();
        } else if (e.key === '/') {
          e.preventDefault();
          toggleRightSidebar();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleRightSidebar]);

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Left Sidebar */}
      {leftSidebarOpen && (
        <LeftSidebar 
          width={leftSidebarWidth}
          onResize={setLeftSidebarWidth}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Canvas with integrated toggle buttons */}
        <div className="relative flex-1">
          {/* Sidebar Toggle Buttons (when sidebars are closed) */}
          {!leftSidebarOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLeftSidebar}
              className="absolute top-16 left-4 z-50 h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
              title="Show Notes (Ctrl/⌘+K)"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}

          {!rightSidebarOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleRightSidebar}
              className="absolute top-16 right-4 z-50 h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
              title="Show AI Chat (Ctrl/⌘+/)"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          )}

          <Canvas />
        </div>

      </div>

      {/* Right Sidebar */}
      {rightSidebarOpen && (
        <RightSidebarChat 
          width={rightSidebarWidth}
          onResize={setRightSidebarWidth}
        />
      )}
    </div>
  );
};

export default Index;