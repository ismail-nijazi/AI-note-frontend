import React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	onKeyDown: (event: React.KeyboardEvent) => void;
	isGenerating: boolean;
	enabled: boolean;
	textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export const MessageInput: React.FC<
	MessageInputProps
> = ({
	value,
	onChange,
	onSend,
	onKeyDown,
	isGenerating,
	enabled,
	textareaRef,
}) => (
	<div className="p-3 border-t border-border">
		<div className="flex gap-2">
			<Textarea
				ref={textareaRef}
				placeholder={
					enabled
						? "Ask me anything..."
						: "Select a note first..."
				}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={onKeyDown}
				disabled={isGenerating || !enabled}
				className="flex-1 text-sm resize-none leading-relaxed"
				style={{
					minHeight: "60px",
					maxHeight: "168px",
				}}
			/>
			<Button
				onClick={onSend}
				disabled={
					!value.trim() || isGenerating || !enabled
				}
				size="sm"
				className="self-end">
				<Send className="h-4 w-4" />
			</Button>
		</div>
		<p className="text-xs text-muted-foreground mt-2">
			Press Enter to send, Shift+Enter for new line
		</p>
	</div>
);


