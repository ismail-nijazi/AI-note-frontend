import React, { useEffect, useState } from 'react';
import { Canvas } from '@/components/Canvas';
import { LeftSidebar } from '@/components/sidebar/LeftSidebar';
import { RightSidebarChat } from '@/components/sidebar/RightSidebarChat';
import { GlobalToolbar } from '@/components/GlobalToolbar';
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { useAIStore } from '@/state/useAIStore';

const Index = () => {
  const [toolbarCallbacks, setToolbarCallbacks] = useState<any>({});

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
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Global Toolbar - spans full width */}
      <GlobalToolbar 
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        onToggleLeftSidebar={toggleLeftSidebar}
        onToggleRightSidebar={toggleRightSidebar}
        {...toolbarCallbacks}
      />

      {/* Body with sidebars and main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        {leftSidebarOpen && (
          <div className="animate-slide-in-left">
            <LeftSidebar 
              width={leftSidebarWidth}
              onResize={setLeftSidebarWidth}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Canvas onToolbarCallbacksChange={setToolbarCallbacks} />
        </div>

        {/* Right Sidebar */}
        {rightSidebarOpen && (
          <div className="animate-slide-in-right">
            <RightSidebarChat 
              width={rightSidebarWidth}
              onResize={setRightSidebarWidth}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;