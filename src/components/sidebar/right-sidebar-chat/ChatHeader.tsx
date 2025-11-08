import React from "react";
import {
	PanelRightClose,
	RotateCcw,
	Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
	aiStatus: "available" | "error" | "unknown";
	noteTitle?: string;
	canClear: boolean;
	onClear?: () => void;
	onToggleSidebar: () => void;
}

export const ChatHeader: React.FC<
	ChatHeaderProps
> = ({
	aiStatus,
	noteTitle,
	canClear,
	onClear,
	onToggleSidebar,
}) => {
	const statusClass =
		aiStatus === "available"
			? "bg-green-500"
			: aiStatus === "error"
			? "bg-red-500"
			: "bg-yellow-500";
	const statusTitle =
		aiStatus === "available"
			? "AI Available"
			: aiStatus === "error"
			? "AI Service Error"
			: "AI Status Unknown";

	return (
		<div className="flex items-center justify-between p-3 border-b border-border">
			<div className="flex items-center gap-2">
				<Sparkles className="h-4 w-4 text-primary" />
				<div>
					<div className="flex items-center gap-2">
						<h3 className="font-semibold text-sm">
							AI Assistant
						</h3>
						<div
							className={`h-2 w-2 rounded-full ${statusClass}`}
							title={statusTitle}
						/>
					</div>
					{noteTitle && (
						<p className="text-xs text-muted-foreground truncate">
							{noteTitle}
						</p>
					)}
				</div>
			</div>
			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					onClick={onClear}
					className="h-7 w-7 p-0"
					title="Clear Chat"
					disabled={!canClear}>
					<RotateCcw className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={onToggleSidebar}
					className="h-7 w-7 p-0"
					title="Close Sidebar">
					<PanelRightClose className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};


