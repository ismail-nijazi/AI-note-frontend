import React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ContextToggleProps {
	includeContext: boolean;
	onToggle: (include: boolean) => void;
}

export const ContextToggle: React.FC<
	ContextToggleProps
> = ({ includeContext, onToggle }) => (
	<div className="p-3 border-b border-border">
		<div className="flex items-center justify-between">
			<Label
				htmlFor="include-context"
				className="text-xs">
				Include Context
			</Label>
			<Switch
				id="include-context"
				checked={includeContext}
				onCheckedChange={onToggle}
			/>
		</div>
		{includeContext && (
			<p className="text-xs text-muted-foreground mt-1">
				AI can see note content and selected
				text
			</p>
		)}
	</div>
);


