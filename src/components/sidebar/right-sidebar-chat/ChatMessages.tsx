import React from "react";
import {
	MessageSquare,
	Sparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/state/useAIStore";
import { ChatMessageBubble } from "./ChatMessageBubble";

interface ChatMessagesProps {
	hasActiveNote: boolean;
	chatHistory: ChatMessage[];
	streamingMessage: string;
	isGenerating: boolean;
	onCopy: (content: string) => void;
	onInsert: (content: string) => void;
	onApplyEdits: (content: string) => void;
	messagesEndRef: React.RefObject<HTMLDivElement>;
	scrollContainerRef: React.RefObject<HTMLDivElement>;
}

export const ChatMessages: React.FC<
	ChatMessagesProps
> = ({
	hasActiveNote,
	chatHistory,
	streamingMessage,
	isGenerating,
	onCopy,
	onInsert,
	onApplyEdits,
	messagesEndRef,
	scrollContainerRef,
}) => (
	<ScrollArea
		ref={scrollContainerRef}
		className="flex-1 min-h-0 p-3">
		{!hasActiveNote ? (
			<div className="text-center text-muted-foreground text-sm py-8">
				<MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
				<p>Select a note to start chatting</p>
			</div>
		) : chatHistory.length === 0 &&
		  !streamingMessage ? (
			<div className="text-center text-muted-foreground text-sm py-8">
				<Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
				<p>Start a conversation</p>
				<p className="text-xs mt-1">
					Use quick actions or ask anything
				</p>
			</div>
		) : (
			<div className="space-y-4">
				{chatHistory.map((message) => (
					<ChatMessageBubble
						key={message.id}
						message={message}
						onCopy={onCopy}
						onInsert={onInsert}
						onApplyEdits={onApplyEdits}
					/>
				))}
				{isGenerating && !streamingMessage && (
					<div className="flex justify-start">
						<div className="bg-muted rounded-lg p-3">
							<div className="flex items-center gap-1.5">
								<div className="w-2 h-2 bg-muted-foreground/60 rounded-full loading-dot-1"></div>
								<div className="w-2 h-2 bg-muted-foreground/60 rounded-full loading-dot-2"></div>
								<div className="w-2 h-2 bg-muted-foreground/60 rounded-full loading-dot-3"></div>
							</div>
						</div>
					</div>
				)}
				{streamingMessage && (
					<ChatMessageBubble
						key={`streaming-${streamingMessage.length}`}
						message={{
							id: "streaming",
							role: "assistant",
							content: streamingMessage,
							timestamp: Date.now(),
						}}
						onCopy={onCopy}
						onInsert={onInsert}
						onApplyEdits={onApplyEdits}
						isStreaming
					/>
				)}
				<div ref={messagesEndRef} />
			</div>
		)}
	</ScrollArea>
);


