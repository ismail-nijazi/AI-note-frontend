import React, { useEffect, useState } from 'react';
import { Canvas } from '@/components/Canvas';
import { LeftSidebar } from '@/components/sidebar/LeftSidebar';
import { RightSidebarChat } from '@/components/sidebar/RightSidebarChat';
import { GlobalToolbar } from '@/components/GlobalToolbar';
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { useAIStore } from '@/state/useAIStore';

const Index = () => {
  const [toolbarCallbacks, setToolbarCallbacks] = useState<any>({});
  
  // Animation states for smooth transitions
  const [leftSidebarClosing, setLeftSidebarClosing] = useState(false);
  const [rightSidebarClosing, setRightSidebarClosing] = useState(false);

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

  // Handle left sidebar animations
  useEffect(() => {
    if (leftSidebarOpen) {
      setLeftSidebarClosing(false);
    } else if (!leftSidebarOpen && !leftSidebarClosing) {
      // Start closing animation
      setLeftSidebarClosing(true);
      setTimeout(() => {
        setLeftSidebarClosing(false);
      }, 300); // Match animation duration
    }
  }, [leftSidebarOpen, leftSidebarClosing]);

  // Handle right sidebar animations
  useEffect(() => {
    if (rightSidebarOpen) {
      setRightSidebarClosing(false);
    } else if (!rightSidebarOpen && !rightSidebarClosing) {
      // Start closing animation
      setRightSidebarClosing(true);
      setTimeout(() => {
        setRightSidebarClosing(false);
      }, 300); // Match animation duration
    }
  }, [rightSidebarOpen, rightSidebarClosing]);

  // Initialize sidebar states on mount
  useEffect(() => {
    setLeftSidebarClosing(false);
    setRightSidebarClosing(false);
  }, []);

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
        {(leftSidebarOpen || leftSidebarClosing) && (
          <div className={`${
            leftSidebarOpen && !leftSidebarClosing ? 'animate-slide-in-left' : 
            leftSidebarClosing ? 'animate-slide-out-left' : ''
          }`}>
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
        {(rightSidebarOpen || rightSidebarClosing) && (
          <div className={`${
            rightSidebarOpen && !rightSidebarClosing ? 'animate-slide-in-right' : 
            rightSidebarClosing ? 'animate-slide-out-right' : ''
          }`}>
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