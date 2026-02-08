import React from "react";

interface CanvasZoomDisplayProps {
  scale: number;
}

export const CanvasZoomDisplay: React.FC<CanvasZoomDisplayProps> = ({
  scale,
}) => {
  return (
    <div className="absolute top-4 right-4 pointer-events-none">
      <div className="bg-background/80 backdrop-blur-sm border border-border rounded-md px-2 py-1">
        <span className="text-xs text-muted-foreground font-mono">
          {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  );
};
