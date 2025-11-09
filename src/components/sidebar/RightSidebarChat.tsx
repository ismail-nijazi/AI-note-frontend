import React, {
	useState,
	useRef,
	useEffect,
	useMemo,
} from "react";
import { Descendant } from "slate";
import { produce } from "immer";
import { useAIStore } from "@/state/useAIStore";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";
import {
	useBoardStore,
	type NoteBox,
} from "@/state/useBoardStore";
import {
	aiService,
	type FunctionResultChunk,
} from "@/services/ai";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import type { Workspace } from "@/state/useWorkspaceStore";
import { ChatHeader } from "./right-sidebar-chat/ChatHeader";
import { ContextToggle } from "./right-sidebar-chat/ContextToggle";
import {
	QuickActions,
	DEFAULT_QUICK_ACTIONS,
} from "./right-sidebar-chat/QuickActions";
import { SyncNotice } from "./right-sidebar-chat/SyncNotice";
import { ChatMessages } from "./right-sidebar-chat/ChatMessages";
import { MessageInput } from "./right-sidebar-chat/MessageInput";

interface RightSidebarChatProps {
	width: number;
	onResize: (width: number) => void;
}

type NoteApiResponse = {
	content?: unknown;
	title?: string;
	version?: number;
	zoom?: number;
	pan?: {
		x?: number;
		y?: number;
	} | null;
};

const isBoxesWrapper = (
	value: unknown
): value is { boxes: unknown[] } =>
	typeof value === "object" &&
	value !== null &&
	"boxes" in value &&
	Array.isArray(
		(value as { boxes?: unknown[] }).boxes
	);

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
		loadNote,
		canvasTransform,
	} = useBoardStore();

	const [
		streamingMessage,
		setStreamingMessage,
	] = useState("");
	const [pendingVersion, setPendingVersion] =
		useState<number | null>(null);
	const [isAwaitingSync, setIsAwaitingSync] =
		useState(false);
	const messagesEndRef =
		useRef<HTMLDivElement>(null);
	const scrollContainerRef =
		useRef<HTMLDivElement>(null);
	const textareaRef =
		useRef<HTMLTextAreaElement>(null);

	const currentNote = getCurrentNote();
	const currentNoteVersion =
		currentNote?.version ?? null;
	const fallbackRefreshTimeout =
		useRef<ReturnType<
			typeof setTimeout
		> | null>(null);
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

	useEffect(() => {
		return () => {
			if (fallbackRefreshTimeout.current) {
				clearTimeout(
					fallbackRefreshTimeout.current
				);
			}
		};
	}, []);

	useEffect(() => {
		if (!isAwaitingSync) {
			if (fallbackRefreshTimeout.current) {
				clearTimeout(
					fallbackRefreshTimeout.current
				);
				fallbackRefreshTimeout.current =
					null;
			}
			return;
		}
		if (pendingVersion === null) {
			return;
		}
		if (
			currentNoteVersion !== null &&
			currentNoteVersion >= pendingVersion
		) {
			if (fallbackRefreshTimeout.current) {
				clearTimeout(
					fallbackRefreshTimeout.current
				);
				fallbackRefreshTimeout.current =
					null;
			}
			setIsAwaitingSync(false);
			setPendingVersion(null);
		}
	}, [
		isAwaitingSync,
		pendingVersion,
		currentNoteVersion,
	]);

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
							{
								id: "guard",
								role: "user" as const,
								content: `Guidelines: 
- DEFAULT: Answer in chat. Do not modify the note unless the user explicitly instructs you to create, update, or rename something.
- Only create boxes when the user clearly asks to add one. 
- When the user asks to UPDATE an existing box, identify the correct box before acting. 
- If you know the exact box id or title, include it in update_box_content. 
- If you are unsure, call find_boxes first; if multiple matches are returned, call confirm_box_selection so the user can pick one. 
- Do not create duplicate boxes when the user asked to update. 
- Always confirm your changes once the function succeeds.`,
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

			const handleFunctionResult = async (
				chunk: FunctionResultChunk
			) => {
				if (!currentNote) {
					return;
				}

				if (
					fallbackRefreshTimeout.current
				) {
					clearTimeout(
						fallbackRefreshTimeout.current
					);
					fallbackRefreshTimeout.current =
						null;
				}

				const parsePayload = () => {
					if (
						chunk.result &&
						typeof chunk.result ===
							"object"
					) {
						return chunk.result as Record<
							string,
							unknown
						>;
					}

					const rawResult = (
						chunk.raw as
							| Record<
									string,
									unknown
							  >
							| undefined
					)?.result;
					if (
						typeof rawResult ===
						"string"
					) {
						try {
							return JSON.parse(
								rawResult
							) as Record<
								string,
								unknown
							>;
						} catch (error) {
							console.warn(
								"Chat: Failed to parse function result payload:",
								error
							);
						}
					}

					if (
						chunk.raw &&
						typeof chunk.raw ===
							"object"
					) {
						return chunk.raw as Record<
							string,
							unknown
						>;
					}

					return undefined;
				};

				const payload = parsePayload();
				if (!payload) {
					console.warn(
						"Chat: Missing payload in function result chunk"
					);
					return;
				}

				const success =
					(payload.success as
						| boolean
						| undefined) !== false;
				const message =
					typeof payload.message ===
					"string"
						? payload.message
						: undefined;
				const version =
					typeof payload.version ===
					"number"
						? payload.version
						: null;
				const action =
					typeof payload.action ===
					"string"
						? payload.action
						: undefined;

				if (message) {
					setStreamingMessage(message);
					fullResponse = message;
				}

				if (
					action === "find_results" ||
					action === "confirm_selection"
				) {
					const formatOptions = (
						items: Array<
							Record<
								string,
								unknown
							>
						>
					): string => {
						return items
							.map((item, idx) => {
								const optionTitle =
									typeof item.title ===
									"string"
										? item.title
										: `Option ${
												idx +
												1
										  }`;
								const optionIndex =
									typeof item.index ===
									"number"
										? item.index
										: idx;
								const preview =
									typeof item.preview ===
									"string"
										? item.preview
										: undefined;
								const parts = [
									`${
										idx + 1
									}. ${optionTitle} (index ${optionIndex})`,
								];
								if (preview) {
									parts.push(
										`   Preview: ${preview}`
									);
								}
								return parts.join(
									"\n"
								);
							})
							.join("\n");
					};

					let formatted = message || "";

					if (
						action ===
							"find_results" &&
						Array.isArray(
							payload.matches
						)
					) {
						const list =
							formatOptions(
								payload.matches as Array<
									Record<
										string,
										unknown
									>
								>
							);
						formatted = [
							message ||
								"Here are the boxes I found:",
							list,
						]
							.filter(Boolean)
							.join("\n");
					}

					if (
						action ===
							"confirm_selection" &&
						Array.isArray(
							payload.options
						)
					) {
						const list =
							formatOptions(
								payload.options as Array<
									Record<
										string,
										unknown
									>
								>
							);
						formatted = [
							message ||
								"Please confirm which box should be updated:",
							list,
						]
							.filter(Boolean)
							.join("\n");
					}

					setStreamingMessage(
						formatted
					);
					fullResponse = formatted;
				}

				if (!success) {
					toast({
						variant: "destructive",
						title: "AI action failed",
						description:
							message ||
							"Unable to apply AI changes.",
					});
					setPendingVersion(null);
					setIsAwaitingSync(false);
					return;
				}

				if (
					version !== null &&
					!(
						typeof currentNote.version ===
							"number" &&
						currentNote.version >=
							version
					)
				) {
					setPendingVersion(version);
					setIsAwaitingSync(true);
					fallbackRefreshTimeout.current =
						setTimeout(async () => {
							try {
								const res =
									await apiService.getNote(
										currentNote.id
									);
								const data =
									(await res.json()) as NoteApiResponse;

								const content =
									data.content;
								const boxesSource =
									Array.isArray(
										content
									)
										? content
										: isBoxesWrapper(
												content
										  )
										? content.boxes
										: undefined;
								const clonedBoxes =
									Array.isArray(
										boxesSource
									)
										? (JSON.parse(
												JSON.stringify(
													boxesSource
												)
										  ) as NoteBox[])
										: undefined;
								const pan =
									data.pan ??
									{};

								if (clonedBoxes) {
									loadNote(
										clonedBoxes,
										{
											scale:
												typeof data.zoom ===
												"number"
													? data.zoom
													: canvasTransform.scale,
											x:
												typeof pan.x ===
												"number"
													? pan.x
													: canvasTransform.x,
											y:
												typeof pan.y ===
												"number"
													? pan.y
													: canvasTransform.y,
										}
									);
								}

								const collectionId =
									workspace
										.active
										.collectionId;

								if (
									collectionId
								) {
									useWorkspaceStore.setState(
										produce(
											(state: {
												workspace: Workspace;
											}) => {
												const note =
													state
														.workspace
														.collections[
														collectionId
													]
														?.notes[
														currentNote
															.id
													];
												if (
													note
												) {
													if (
														clonedBoxes
													) {
														note.boxes =
															JSON.parse(
																JSON.stringify(
																	clonedBoxes
																)
															);
													}
													if (
														typeof data.title ===
														"string"
													) {
														note.title =
															data.title;
													}
													if (
														typeof data.version ===
														"number"
													) {
														note.version =
															data.version;
													}
													if (
														typeof data.zoom ===
														"number"
													) {
														note.zoom =
															data.zoom;
													}
													if (
														data.pan &&
														typeof data.pan ===
															"object"
													) {
														note.pan =
															{
																x:
																	typeof data
																		.pan
																		?.x ===
																	"number"
																		? data
																				.pan
																				.x
																		: note
																				.pan
																				.x,
																y:
																	typeof data
																		.pan
																		?.y ===
																	"number"
																		? data
																				.pan
																				.y
																		: note
																				.pan
																				.y,
															};
													}
												}
											}
										)
									);
								}
							} catch (error) {
								console.error(
									"Chat: Fallback refresh failed:",
									error
								);
							} finally {
								setIsAwaitingSync(
									false
								);
								setPendingVersion(
									null
								);
								fallbackRefreshTimeout.current =
									null;
							}
						}, 1500);
				} else {
					setPendingVersion(null);
					setIsAwaitingSync(false);
				}

				console.log(
					"Chat: AI function applied, awaiting note version:",
					version
				);
			};

			try {
				for await (const chunk of generator) {
					console.log(
						"Chat: Received chunk:",
						chunk
					);

					if (
						typeof chunk !== "string"
					) {
						if (
							chunk.type ===
							"function_result"
						) {
							await handleFunctionResult(
								chunk
							);
							requestAnimationFrame(
								() => {
									scrollToBottom();
								}
							);
						}
						continue;
					}

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
		if (!currentNote || isGenerating) {
			return;
		}
		void handleSendMessage(command);
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
			<ChatHeader
				aiStatus={aiStatus}
				noteTitle={currentNote?.title}
				canClear={
					!!currentNote &&
					chatHistory.length > 0
				}
				onClear={
					currentNote
						? () =>
								clearChatHistory(
									currentNote.id
								)
						: undefined
				}
				onToggleSidebar={
					toggleRightSidebar
				}
			/>

			<ContextToggle
				includeContext={includeContext}
				onToggle={setIncludeContext}
			/>

			<QuickActions
				actions={DEFAULT_QUICK_ACTIONS}
				disabled={
					!currentNote || isGenerating
				}
				onSelect={handleQuickAction}
			/>

			{isAwaitingSync && <SyncNotice />}

			<ChatMessages
				hasActiveNote={!!currentNote}
				chatHistory={chatHistory}
				streamingMessage={
					streamingMessage
				}
				isGenerating={isGenerating}
				onCopy={handleCopyMessage}
				onInsert={handleInsertToBox}
				onApplyEdits={handleApplyAIEdits}
				messagesEndRef={messagesEndRef}
				scrollContainerRef={
					scrollContainerRef
				}
			/>

			<MessageInput
				value={currentInput}
				onChange={setCurrentInput}
				onSend={handleSendMessage}
				onKeyDown={handleKeyDown}
				isGenerating={isGenerating}
				enabled={!!currentNote}
				textareaRef={textareaRef}
			/>

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
