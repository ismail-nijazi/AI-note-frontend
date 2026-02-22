import React from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContextPromptsProps {
  prompts: string[];
  disabled?: boolean;
  onSelect: (prompt: string) => void;
}

export const ContextPrompts: React.FC<ContextPromptsProps> = ({
  prompts,
  disabled,
  onSelect,
}) => {
  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="p-3 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5" />
        <span>Context suggestions</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            variant="secondary"
            size="sm"
            disabled={disabled}
            className="h-7 text-xs"
            onClick={() => onSelect(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
};
