import React, { useEffect, useState, useRef } from 'react';
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
  
  // Refs to track timeouts
  const leftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    // Clear any existing timeout
    if (leftTimeoutRef.current) {
      clearTimeout(leftTimeoutRef.current);
      leftTimeoutRef.current = null;
    }

    if (!leftSidebarOpen && !leftSidebarClosing) {
      // Start closing animation
      setLeftSidebarClosing(true);
      leftTimeoutRef.current = setTimeout(() => {
        setLeftSidebarClosing(false);
        leftTimeoutRef.current = null;
      }, 300);
    } else if (leftSidebarOpen && leftSidebarClosing) {
      // Cancel closing if reopened
      setLeftSidebarClosing(false);
    }

    // Cleanup function
    return () => {
      if (leftTimeoutRef.current) {
        clearTimeout(leftTimeoutRef.current);
        leftTimeoutRef.current = null;
      }
    };
  }, [leftSidebarOpen]);

  // Handle right sidebar animations
  useEffect(() => {
    // Clear any existing timeout
    if (rightTimeoutRef.current) {
      clearTimeout(rightTimeoutRef.current);
      rightTimeoutRef.current = null;
    }

    if (!rightSidebarOpen && !rightSidebarClosing) {
      // Start closing animation
      setRightSidebarClosing(true);
      rightTimeoutRef.current = setTimeout(() => {
        setRightSidebarClosing(false);
        rightTimeoutRef.current = null;
      }, 300);
    } else if (rightSidebarOpen && rightSidebarClosing) {
      // Cancel closing if reopened
      setRightSidebarClosing(false);
    }

    // Cleanup function
    return () => {
      if (rightTimeoutRef.current) {
        clearTimeout(rightTimeoutRef.current);
        rightTimeoutRef.current = null;
      }
    };
  }, [rightSidebarOpen]);

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
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-out">
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