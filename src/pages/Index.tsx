import React, { useEffect, useState } from 'react';
import { Canvas } from '@/components/Canvas';
import { LeftSidebar } from '@/components/sidebar/LeftSidebar';
import { RightSidebarChat } from '@/components/sidebar/RightSidebarChat';
import { GlobalToolbar } from '@/components/GlobalToolbar';
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

  // Animation states
  const [leftSidebarAnimating, setLeftSidebarAnimating] = useState(false);
  const [rightSidebarAnimating, setRightSidebarAnimating] = useState(false);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(leftSidebarOpen);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(rightSidebarOpen);

  // Load data on mount
  useEffect(() => {
    loadWorkspace();
    loadAI();
  }, [loadWorkspace, loadAI]);

  // Handle left sidebar animation
  useEffect(() => {
    if (leftSidebarOpen && !leftSidebarVisible) {
      setLeftSidebarVisible(true);
      setLeftSidebarAnimating(true);
      setTimeout(() => setLeftSidebarAnimating(false), 300);
    } else if (!leftSidebarOpen && leftSidebarVisible) {
      setLeftSidebarAnimating(true);
      setTimeout(() => {
        setLeftSidebarVisible(false);
        setLeftSidebarAnimating(false);
      }, 300);
    }
  }, [leftSidebarOpen, leftSidebarVisible]);

  // Handle right sidebar animation
  useEffect(() => {
    if (rightSidebarOpen && !rightSidebarVisible) {
      setRightSidebarVisible(true);
      setRightSidebarAnimating(true);
      setTimeout(() => setRightSidebarAnimating(false), 300);
    } else if (!rightSidebarOpen && rightSidebarVisible) {
      setRightSidebarAnimating(true);
      setTimeout(() => {
        setRightSidebarVisible(false);
        setRightSidebarAnimating(false);
      }, 300);
    }
  }, [rightSidebarOpen, rightSidebarVisible]);

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
      />

      {/* Body with sidebars and main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        {leftSidebarVisible && (
          <div className={`${leftSidebarOpen && !leftSidebarAnimating ? 'animate-slide-in-left' : 'animate-slide-out-left'}`}>
            <LeftSidebar 
              width={leftSidebarWidth}
              onResize={setLeftSidebarWidth}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Canvas />
        </div>

        {/* Right Sidebar */}
        {rightSidebarVisible && (
          <div className={`${rightSidebarOpen && !rightSidebarAnimating ? 'animate-slide-in-right' : 'animate-slide-out-right'}`}>
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