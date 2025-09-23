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
  const [leftSidebarAnimating, setLeftSidebarAnimating] = useState(false);
  const [rightSidebarAnimating, setRightSidebarAnimating] = useState(false);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(false);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(false);

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
    if (leftSidebarOpen && !leftSidebarVisible) {
      // Opening
      setLeftSidebarVisible(true);
      setLeftSidebarAnimating(false); // Reset animation state for opening
    } else if (!leftSidebarOpen && leftSidebarVisible) {
      // Closing
      setLeftSidebarAnimating(true);
      setTimeout(() => {
        setLeftSidebarVisible(false);
        setLeftSidebarAnimating(false);
      }, 300); // Match animation duration
    }
  }, [leftSidebarOpen, leftSidebarVisible]);

  // Handle right sidebar animations
  useEffect(() => {
    if (rightSidebarOpen && !rightSidebarVisible) {
      // Opening
      setRightSidebarVisible(true);
      setRightSidebarAnimating(false); // Reset animation state for opening
    } else if (!rightSidebarOpen && rightSidebarVisible) {
      // Closing
      setRightSidebarAnimating(true);
      setTimeout(() => {
        setRightSidebarVisible(false);
        setRightSidebarAnimating(false);
      }, 300); // Match animation duration
    }
  }, [rightSidebarOpen, rightSidebarVisible]);

  // Initialize sidebar visibility on mount
  useEffect(() => {
    setLeftSidebarVisible(leftSidebarOpen);
    setRightSidebarVisible(rightSidebarOpen);
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
        {leftSidebarVisible && (
          <div className={`${
            leftSidebarOpen ? 'animate-slide-in-left' : 'animate-slide-out-left'
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
        {rightSidebarVisible && (
          <div className={`${
            rightSidebarOpen ? 'animate-slide-in-right' : 'animate-slide-out-right'
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