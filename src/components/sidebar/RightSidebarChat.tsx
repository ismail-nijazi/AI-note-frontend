import React, {
	useState,
	useRef,
	useEffect,
	useMemo,
} from "react";
import { Descendant } from "slate";
import {
	Send,
	Copy,
	RotateCcw,
	Plus,
	Settings,
	PanelRightClose,
	Sparkles,
	MessageSquare,
	FileText,
	Wand2,
	Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	useAIStore,
	ChatMessage,
} from "@/state/useAIStore";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";
import { useBoardStore } from "@/state/useBoardStore";
import { aiService } from "@/services/ai";
import { useToast } from "@/hooks/use-toast";

interface RightSidebarChatProps {
	width: number;
	onResize: (width: number) => void;
}

const quickActions = [
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

export const RightSidebarChat: React.FC<
	RightSidebarChatProps
> = ({ width, onResize }) => {
	const {
		rightSidebarOpen,
		currentInput,
		isGenerating,
		includeContext,
		aiStatus,
		chatHistories,
		setCurrentInput,
		addMessage,
		getChatHistory,
		clearChatHistory,
		setIsGenerating,
		setIncludeContext,
		setAiStatus,
		toggleRightSidebar,
	} = useAIStore();

	const { toast } = useToast();

	const {
		getCurrentNote,
		workspace,
		updateNote,
	} = useWorkspaceStore();
	const {
		noteBoxes,
		selectedBoxId,
		editingBoxId,
		addNoteBox,
		insertContentToBox,
		replaceBoxContent,
		appendTextToBox,
		selectNoteBox,
		setEditingBox,
	} = useBoardStore();

	const [
		streamingMessage,
		setStreamingMessage,
	] = useState("");
	const messagesEndRef =
		useRef<HTMLDivElement>(null);
	const scrollContainerRef =
		useRef<HTMLDivElement>(null);
	const textareaRef =
		useRef<HTMLTextAreaElement>(null);

	const currentNote = getCurrentNote();
	// Get chat history directly from store state to ensure reactivity
	// Memoize to avoid unnecessary recalculations, but still reactive to chatHistories changes
	const chatHistory = useMemo(() => {
		return currentNote
			? chatHistories[currentNote.id] || []
			: [];
	}, [currentNote, chatHistories]);

	const scrollToBottom = () => {
		// Find the scrollable viewport inside ScrollArea
		// Radix ScrollArea creates a viewport element inside the root
		const root = scrollContainerRef.current;
		if (!root) return;

		// The viewport is the first child div with scroll capabilities
		const viewport =
			(root.querySelector(
				'[style*="overflow"]'
			) as HTMLElement) ||
			(root.firstElementChild as HTMLElement);

		if (
			viewport &&
			viewport.scrollHeight >
				viewport.clientHeight
		) {
			viewport.scrollTop =
				viewport.scrollHeight;
		} else if (messagesEndRef.current) {
			// Fallback: find scrollable parent of messagesEndRef
			let parent =
				messagesEndRef.current
					.parentElement;
			while (parent && parent !== root) {
				if (
					parent.scrollHeight >
					parent.clientHeight
				) {
					parent.scrollTop =
						parent.scrollHeight;
					break;
				}
				parent = parent.parentElement;
			}
		}
	};

	useEffect(() => {
		scrollToBottom();
	}, [chatHistory, streamingMessage]);

	// Debug: Log when streamingMessage changes
	useEffect(() => {
		if (streamingMessage) {
			console.log(
				"Chat: streamingMessage changed, length:",
				streamingMessage.length,
				"preview:",
				streamingMessage.substring(0, 50)
			);
		}
	}, [streamingMessage]);

	// Auto-grow textarea based on content
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		// Reset height to auto to get the correct scrollHeight
		textarea.style.height = "auto";

		// Calculate the content height
		const scrollHeight =
			textarea.scrollHeight;

		// Set max height for 6 lines (approximately 168px)
		const maxHeight = 168;
		const minHeight = 60; // Minimum height for 1 line

		// Set the height, capping at maxHeight
		if (scrollHeight > maxHeight) {
			textarea.style.height = `${maxHeight}px`;
			textarea.style.overflowY = "auto";
		} else {
			textarea.style.height = `${Math.max(
				scrollHeight,
				minHeight
			)}px`;
			textarea.style.overflowY = "hidden";
		}
	}, [currentInput]);

	const handleSendMessage = async (
		message?: string
	) => {
		const input =
			message || currentInput.trim();
		if (!input || isGenerating) return;

		if (!currentNote) {
			alert("Please select a note first");
			return;
		}

		// Add user message
		addMessage(currentNote.id, {
			role: "user",
			content: input,
		});
		setCurrentInput("");
		setIsGenerating(true);
		setStreamingMessage("");

		try {
			// Prepare context
			const context = {
				note: currentNote,
				noteId: currentNote?.id,
				collectionId:
					workspace.active.collectionId,
				selectedBoxContent: selectedBoxId
					? noteBoxes
							.find(
								(box) =>
									box.id ===
									selectedBoxId
							)
							?.content.map(
								(
									node: Descendant
								) => {
									if (
										"text" in
										node
									) {
										return node.text;
									}
									if (
										"children" in
										node
									) {
										return node.children
											?.map(
												(
													child: Descendant
												) => {
													if (
														"text" in
														child
													) {
														return child.text;
													}
													return "";
												}
											)
											.join(
												" "
											);
									}
									return "";
								}
							)
							.join(" ")
					: undefined,
			};

			console.log(
				"Chat: Starting AI generation with input:",
				input
			);
			console.log(
				"Chat: Context:",
				context
			);
			console.log(
				"Chat: Include context:",
				includeContext
			);

			// Prepare messages - add system context at the start if this is first message
			const messagesToSend =
				chatHistory.length === 0
					? [
							{
								id: "system",
								role: "user" as const,
								content: `Context: You are an AI assistant helping with note-taking. You can read note content, suggest edits, and when asked to make changes, you can format responses with commands like "update title to 'New Title'" or "replace content with 'New Content'" (when a box is selected).`,
								timestamp: 0,
							},
							...chatHistory,
							{
								id: "temp",
								role: "user" as const,
								content: input,
								timestamp:
									Date.now(),
							},
					  ]
					: [
							...chatHistory,
							{
								id: "temp",
								role: "user" as const,
								content: input,
								timestamp:
									Date.now(),
							},
					  ];

			// Generate AI response
			const generator = aiService.generate({
				messages: messagesToSend,
				context,
				includeContext,
			});

			let fullResponse = "";
			console.log(
				"Chat: Starting to iterate over generator..."
			);

			try {
				for await (const chunk of generator) {
					console.log(
						"Chat: Received chunk:",
						chunk
					);

					// Update full response
					fullResponse = chunk;

					// Update state immediately
					setStreamingMessage(chunk);
					console.log(
						"Chat: Updated streamingMessage state to:",
						chunk.substring(0, 50) +
							"..."
					);

					// Small delay to allow React to process the state update
					await new Promise((resolve) =>
						setTimeout(resolve, 10)
					);

					// Force scroll to bottom on each update
					requestAnimationFrame(() => {
						scrollToBottom();
					});
				}
			} catch (genError) {
				console.error(
					"Chat: Generator error:",
					genError
				);
				throw genError;
			}

			console.log(
				"Chat: Final response:",
				fullResponse
			);

			// Only add message if we got a response
			if (fullResponse.trim()) {
				// Add assistant message to store
				addMessage(currentNote.id, {
					role: "assistant",
					content: fullResponse,
				});

				// Wait for the store to update and React to re-render
				// Get fresh state from store since we're in an async function
				let attempts = 0;
				while (attempts < 10) {
					await new Promise((resolve) =>
						setTimeout(resolve, 20)
					);
					// Get fresh state from store directly (outside React render cycle)
					const freshState =
						useAIStore.getState();
					const updatedHistory =
						freshState.chatHistories[
							currentNote.id
						] || [];
					const messageExists =
						updatedHistory.some(
							(msg) =>
								msg.role ===
									"assistant" &&
								msg.content ===
									fullResponse
						);
					if (messageExists) {
						console.log(
							"Chat: Message confirmed in history, clearing streaming"
						);
						break;
					}
					attempts++;
				}
			}

			// Clear streaming message after the saved message is confirmed in the store
			setStreamingMessage("");
			setAiStatus("available"); // Mark AI as available after successful response
		} catch (error) {
			console.error(
				"AI generation error:",
				error
			);

			// Determine user-friendly error message and code
			let errorMessage =
				"Sorry, I encountered an error. Please try again.";
			let errorCode =
				"AI_GENERATION_FAILED";
			let toastTitle = "AI Error";

			if (error instanceof Error) {
				// Extract error code if available
				if (
					"code" in error &&
					typeof error.code === "string"
				) {
					errorCode = error.code;
				}

				// Determine specific error message based on code or message content
				if (
					errorCode ===
						"QUOTA_EXCEEDED" ||
					error.message.includes(
						"429"
					) ||
					error.message.includes(
						"quota"
					)
				) {
					errorMessage =
						"AI service is temporarily unavailable due to usage limits. Please try again later or check your OpenAI account.";
					toastTitle = "Quota Exceeded";
					setAiStatus("error");
				} else if (
					errorCode ===
						"AUTHENTICATION_FAILED" ||
					error.message.includes(
						"401"
					) ||
					error.message.includes(
						"unauthorized"
					)
				) {
					errorMessage =
						"AI service authentication failed. Please check the API configuration.";
					toastTitle =
						"Authentication Failed";
					setAiStatus("error");
				} else if (
					errorCode ===
						"RATE_LIMIT_EXCEEDED" ||
					error.message.includes(
						"rate limit"
					)
				) {
					errorMessage =
						"AI service rate limit exceeded. Please try again in a few moments.";
					toastTitle =
						"Rate Limit Exceeded";
					setAiStatus("error");
				} else if (
					errorCode ===
						"NETWORK_ERROR" ||
					error.message.includes(
						"network"
					) ||
					error.message.includes(
						"fetch"
					) ||
					error.message.includes(
						"Failed to fetch"
					)
				) {
					errorMessage =
						"Unable to connect to AI service. Please check your internet connection.";
					toastTitle =
						"Connection Error";
					setAiStatus("error");
				} else {
					// Use the error message directly, removing "AI service error: " prefix if present
					errorMessage =
						error.message.replace(
							/^AI service error: /i,
							""
						) || errorMessage;
					setAiStatus("error");
				}
			}

			// Show toast notification
			toast({
				variant: "destructive",
				title: toastTitle,
				description: errorMessage,
			});

			// Add error message to chat with error styling
			addMessage(currentNote.id, {
				role: "assistant",
				content: `⚠️ Error: ${errorMessage}`,
			});
			setStreamingMessage("");
		} finally {
			setIsGenerating(false);
		}
	};

	const handleQuickAction = (
		command: string
	) => {
		setCurrentInput(command + " ");
		textareaRef.current?.focus();
	};

	const handleCopyMessage = (
		content: string
	) => {
		navigator.clipboard.writeText(content);
	};

	const handleInsertToBox = (
		content: string
	) => {
		if (selectedBoxId) {
			// Insert into selected box
			appendTextToBox(
				selectedBoxId,
				content
			);
			// Select and focus the box
			selectNoteBox(selectedBoxId);
			setEditingBox(selectedBoxId);

			toast({
				title: "Content inserted",
				description:
					"AI content has been added to the selected note box.",
			});
		} else {
			// Create new box with content at center of canvas
			const canvas = document.querySelector(
				'[data-canvas="true"]'
			);
			if (canvas) {
				const rect =
					canvas.getBoundingClientRect();
				const centerX = rect.width / 2;
				const centerY = rect.height / 2;
				addNoteBox(centerX, centerY);

				// Wait a bit for the box to be created, then set its content
				setTimeout(() => {
					// Get fresh state from store
					const storeState =
						useBoardStore.getState();
					const boxes =
						storeState.noteBoxes;
					const newBox =
						boxes[boxes.length - 1];
					if (newBox) {
						replaceBoxContent(
							newBox.id,
							content
						);
						selectNoteBox(newBox.id);
						setEditingBox(newBox.id);
					}
				}, 100);

				toast({
					title: "New box created",
					description:
						"A new note box with AI content has been created.",
				});
			}
		}
	};

	// Update note title
	const handleUpdateNoteTitle = async (
		newTitle: string
	) => {
		const note = getCurrentNote();
		if (!note) return;

		try {
			const { collectionId } =
				workspace.active;
			if (!collectionId) return;

			await updateNote(
				collectionId,
				note.id,
				{ title: newTitle }
			);

			toast({
				title: "Note title updated",
				description: `Title changed to "${newTitle}"`,
			});
		} catch (error) {
			console.error(
				"Failed to update note title:",
				error
			);
			toast({
				variant: "destructive",
				title: "Update failed",
				description:
					"Could not update note title.",
			});
		}
	};

	// Parse AI response for edit commands
	const parseAIResponseForEdits = (
		content: string
	) => {
		const edits: {
			type: "title" | "content" | "replace";
			value: string;
		}[] = [];

		// Check for title update commands (more flexible patterns)
		const titlePatterns = [
			/update.*title.*to[:\s]+["']([^"']+)["']/i,
			/change.*title.*to[:\s]+["']([^"']+)["']/i,
			/set.*title.*to[:\s]+["']([^"']+)["']/i,
			/title[:\s]+should.*be[:\s]+["']([^"']+)["']/i,
			/rename.*to[:\s]+["']([^"']+)["']/i,
			/new.*title[:\s]+["']([^"']+)["']/i,
			// Patterns without quotes
			/update.*title.*to[:\s]+(.+?)(?:\n|$)/i,
			/change.*title.*to[:\s]+(.+?)(?:\n|$)/i,
		];

		for (const pattern of titlePatterns) {
			const match = content.match(pattern);
			if (match && match[1]) {
				const title = match[1].trim();
				if (
					title.length > 0 &&
					title.length < 200
				) {
					edits.push({
						type: "title",
						value: title,
					});
					break;
				}
			}
		}

		// Check for content replacement in selected box
		if (selectedBoxId) {
			const replacePatterns = [
				/replace.*content.*with[:\s]+["']([^"']+)["']/i,
				/update.*box.*to[:\s]+["']([^"']+)["']/i,
				/change.*content.*to[:\s]+["']([^"']+)["']/i,
				/replace.*with[:\s]+["']([^"']+)["']/i,
			];

			for (const pattern of replacePatterns) {
				const match =
					content.match(pattern);
				if (match && match[1]) {
					edits.push({
						type: "replace",
						value: match[1],
					});
					break;
				}
			}
		}

		return edits;
	};

	// Apply AI edit commands
	const handleApplyAIEdits = (
		content: string
	) => {
		const edits =
			parseAIResponseForEdits(content);

		if (edits.length === 0) {
			// No edit commands found, just insert content
			handleInsertToBox(content);
			return;
		}

		edits.forEach((edit) => {
			if (edit.type === "title") {
				handleUpdateNoteTitle(edit.value);
			} else if (
				edit.type === "replace" &&
				selectedBoxId
			) {
				replaceBoxContent(
					selectedBoxId,
					edit.value
				);
				toast({
					title: "Content replaced",
					description:
						"AI has updated the selected note box.",
				});
			} else if (edit.type === "content") {
				handleInsertToBox(edit.value);
			}
		});
	};

	const handleKeyDown = (
		e: React.KeyboardEvent
	) => {
		// Enter sends message, Shift+Enter creates new line
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (
				!isGenerating &&
				currentInput.trim() &&
				currentNote
			) {
				handleSendMessage();
			}
		}
		if (e.key === "Escape") {
			textareaRef.current?.blur();
		}
	};

	return (
		<div
			className="flex flex-col h-full bg-card border-l border-border"
			style={{ width }}>
			{/* Header */}
			<div className="flex items-center justify-between p-3 border-b border-border">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-primary" />
					<div>
						<div className="flex items-center gap-2">
							<h3 className="font-semibold text-sm">
								AI Assistant
							</h3>
							{/* AI Status Indicator */}
							<div
								className={`h-2 w-2 rounded-full ${
									aiStatus ===
									"available"
										? "bg-green-500"
										: aiStatus ===
										  "error"
										? "bg-red-500"
										: "bg-yellow-500"
								}`}
								title={
									aiStatus ===
									"available"
										? "AI Available"
										: aiStatus ===
										  "error"
										? "AI Service Error"
										: "AI Status Unknown"
								}
							/>
						</div>
						{currentNote && (
							<p className="text-xs text-muted-foreground truncate">
								{
									currentNote.title
								}
							</p>
						)}
					</div>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							currentNote &&
							clearChatHistory(
								currentNote.id
							)
						}
						className="h-7 w-7 p-0"
						title="Clear Chat"
						disabled={
							!currentNote ||
							chatHistory.length ===
								0
						}>
						<RotateCcw className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={
							toggleRightSidebar
						}
						className="h-7 w-7 p-0"
						title="Close Sidebar">
						<PanelRightClose className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Context Toggle */}
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
						onCheckedChange={
							setIncludeContext
						}
					/>
				</div>
				{includeContext && (
					<p className="text-xs text-muted-foreground mt-1">
						AI can see note content
						and selected text
					</p>
				)}
			</div>

			{/* Quick Actions */}
			<div className="p-3 border-b border-border">
				<div className="grid grid-cols-2 gap-2">
					{quickActions.map(
						(action) => (
							<Button
								key={
									action.command
								}
								variant="outline"
								size="sm"
								onClick={() =>
									handleQuickAction(
										action.command
									)
								}
								className="h-8 text-xs justify-start"
								disabled={
									!currentNote
								}>
								<action.icon className="h-3 w-3 mr-1" />
								{action.label}
							</Button>
						)
					)}
				</div>
			</div>

			{/* Chat Messages */}
			<ScrollArea
				ref={scrollContainerRef}
				className="flex-1 min-h-0 p-3">
				{!currentNote ? (
					<div className="text-center text-muted-foreground text-sm py-8">
						<MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p>
							Select a note to start
							chatting
						</p>
					</div>
				) : chatHistory.length === 0 &&
				  !streamingMessage ? (
					<div className="text-center text-muted-foreground text-sm py-8">
						<Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p>
							Start a conversation
						</p>
						<p className="text-xs mt-1">
							Use quick actions or
							ask anything
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{chatHistory.map(
							(message) => (
								<ChatMessageBubble
									key={
										message.id
									}
									message={
										message
									}
									onCopy={
										handleCopyMessage
									}
									onInsert={
										handleInsertToBox
									}
									onApplyEdits={
										handleApplyAIEdits
									}
								/>
							)
						)}
						{/* Loading indicator when waiting for response */}
						{isGenerating &&
							!streamingMessage && (
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
									content:
										streamingMessage,
									timestamp:
										Date.now(),
								}}
								onCopy={
									handleCopyMessage
								}
								onInsert={
									handleInsertToBox
								}
								onApplyEdits={
									handleApplyAIEdits
								}
								isStreaming
							/>
						)}
						<div
							ref={messagesEndRef}
						/>
					</div>
				)}
			</ScrollArea>

			{/* Input */}
			<div className="p-3 border-t border-border">
				<div className="flex gap-2">
					<Textarea
						ref={textareaRef}
						placeholder={
							currentNote
								? "Ask me anything..."
								: "Select a note first..."
						}
						value={currentInput}
						onChange={(e) =>
							setCurrentInput(
								e.target.value
							)
						}
						onKeyDown={handleKeyDown}
						disabled={
							isGenerating ||
							!currentNote
						}
						className="flex-1 text-sm resize-none leading-relaxed"
						style={{
							minHeight: "60px",
							maxHeight: "168px",
						}}
					/>
					<Button
						onClick={() =>
							handleSendMessage()
						}
						disabled={
							!currentInput.trim() ||
							isGenerating ||
							!currentNote
						}
						size="sm"
						className="self-end">
						<Send className="h-4 w-4" />
					</Button>
				</div>
				<p className="text-xs text-muted-foreground mt-2">
					Press Enter to send,
					Shift+Enter for new line
				</p>
			</div>

			{/* Resize Handle */}
			<div
				className="absolute top-0 left-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-border transition-colors"
				onMouseDown={(e) => {
					const startX = e.clientX;
					const startWidth = width;

					const handleMouseMove = (
						e: MouseEvent
					) => {
						const newWidth =
							startWidth -
							(e.clientX - startX);
						onResize(newWidth);
					};

					const handleMouseUp = () => {
						document.removeEventListener(
							"mousemove",
							handleMouseMove
						);
						document.removeEventListener(
							"mouseup",
							handleMouseUp
						);
					};

					document.addEventListener(
						"mousemove",
						handleMouseMove
					);
					document.addEventListener(
						"mouseup",
						handleMouseUp
					);
				}}
			/>
		</div>
	);
};

interface ChatMessageBubbleProps {
	message: ChatMessage;
	onCopy: (content: string) => void;
	onInsert: (content: string) => void;
	onApplyEdits?: (content: string) => void;
	isStreaming?: boolean;
}

const ChatMessageBubble: React.FC<
	ChatMessageBubbleProps
> = ({
	message,
	onCopy,
	onInsert,
	onApplyEdits,
	isStreaming = false,
}) => {
	const isUser = message.role === "user";
	const isError =
		message.role === "assistant" &&
		(message.content.includes("⚠️") ||
			message.content
				.toLowerCase()
				.includes("error:") ||
			message.content
				.toLowerCase()
				.startsWith("error:"));

	return (
		<div
			className={`flex ${
				isUser
					? "justify-end"
					: "justify-start"
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
						isError
							? "font-medium"
							: ""
					}`}>
					{message.content}
				</div>
				{!isUser && !isStreaming && (
					<div className="flex items-center gap-0.5 mt-2 pt-2 border-t border-border/20 flex-wrap">
						<Button
							variant="ghost"
							size="sm"
							onClick={() =>
								onCopy(
									message.content
								)
							}
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
							onClick={() =>
								onInsert(
									message.content
								)
							}
							className="h-6 px-1.5 text-xs"
							title="Insert">
							<Plus className="h-3 w-3" />
							<span className="sr-only">
								Insert
							</span>
						</Button>
						{onApplyEdits && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									onApplyEdits(
										message.content
									)
								}
								className="h-6 px-1.5 text-xs text-primary"
								title="Apply Edit">
								<Wand2 className="h-3 w-3" />
								<span className="sr-only">
									Apply Edit
								</span>
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
