import React from "react";
import { FileText, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QuickAction {
	label: string;
	command: string;
	icon: LucideIcon;
}

export const DEFAULT_QUICK_ACTIONS: QuickAction[] =
	[
		{
			label: "Summarize",
			command: "/summarize",
			icon: FileText,
		},
		{
			label: "Outline",
			command: "/outline",
			icon: FileText,
		},
		{
			label: "Rewrite",
			command: "/rewrite",
			icon: RotateCcw,
		},
		{
			label: "Todo",
			command: "/todo",
			icon: FileText,
		},
	];

interface QuickActionsProps {
	actions?: QuickAction[];
	disabled?: boolean;
	onSelect: (command: string) => void;
}

export const QuickActions: React.FC<
	QuickActionsProps
> = ({
	actions = DEFAULT_QUICK_ACTIONS,
	disabled,
	onSelect,
}) => {
	if (actions.length === 0) {
		return null;
	}

	return (
		<div className="p-3 border-b border-border">
			<div className="grid grid-cols-2 gap-2">
				{actions.map((action) => (
					<Button
						key={action.command}
						variant="outline"
						size="sm"
						onClick={() =>
							onSelect(action.command)
						}
						className="h-8 text-xs justify-start"
						disabled={disabled}>
						<action.icon className="h-3 w-3 mr-1" />
						{action.label}
					</Button>
				))}
			</div>
		</div>
	);
};


