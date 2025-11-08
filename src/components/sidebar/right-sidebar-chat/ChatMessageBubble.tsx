import React from "react";
import { Copy, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/state/useAIStore";

interface ChatMessageBubbleProps {
	message: ChatMessage;
	onCopy: (content: string) => void;
	onInsert: (content: string) => void;
	onApplyEdits?: (content: string) => void;
	isStreaming?: boolean;
}

export const ChatMessageBubble: React.FC<
	ChatMessageBubbleProps
> = ({
	message,
	onCopy,
	onInsert,
	onApplyEdits: _onApplyEdits,
	isStreaming = false,
}) => {
	const isUser = message.role === "user";
	const content = message.content;
	const isError =
		message.role === "assistant" &&
		(content.includes("⚠️") ||
			content
				.toLowerCase()
				.includes("error:") ||
			content
				.toLowerCase()
				.startsWith("error:"));

	return (
		<div
			className={`flex ${
				isUser ? "justify-end" : "justify-start"
			}`}>
			<div
				className={`
          max-w-[85%] rounded-lg p-3 text-sm
          ${
				isUser
					? "bg-primary text-primary-foreground"
					: isError
					? "bg-destructive/10 border border-destructive/20 text-destructive dark:text-destructive-foreground"
					: "bg-muted text-muted-foreground"
			}
          ${isStreaming ? "animate-pulse" : ""}
        `}>
				<div
					className={`whitespace-pre-wrap ${
						isError ? "font-medium" : ""
					}`}>
					{content}
				</div>
				{!isUser && !isStreaming && (
					<div className="flex items-center gap-0.5 mt-2 pt-2 border-t border-border/20 flex-wrap">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onCopy(content)}
							className="h-6 px-1.5 text-xs"
							title="Copy">
							<Copy className="h-3 w-3" />
							<span className="sr-only">
								Copy
							</span>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onInsert(content)}
							className="h-6 px-1.5 text-xs"
							title="Insert">
							<ClipboardPaste className="h-3 w-3" />
							<span className="sr-only">
								Insert
							</span>
						</Button>
					</div>
				)}
			</div>
		</div>
	);
};


