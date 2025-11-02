import { ChatMessage } from "@/state/useAIStore";
import { Note } from "@/state/useWorkspaceStore";
import { Descendant } from "slate";
import { apiService } from "./api";

export interface AIContext {
	note?: Note;
	selectedBoxContent?: string;
}

export interface AIGenerateOptions {
	messages: ChatMessage[];
	context?: AIContext;
	includeContext?: boolean;
	model?: string;
	maxTokens?: number;
	temperature?: number;
	stream?: boolean;
}

// Real AI service that connects to backend
export class AIService {
	async *generate(
		options: AIGenerateOptions
	): AsyncIterable<string> {
		const {
			messages,
			context,
			model,
			maxTokens,
			temperature,
			stream,
		} = options;

		try {
			console.log(
				"AI Service: Starting generation with options:",
				options
			);

			// Call the real backend API
			const response =
				await apiService.generateAI(
					messages,
					context,
					{
						model,
						maxTokens,
						temperature,
						stream,
					}
				);

			console.log(
				"AI Service: Received response from backend:",
				response.status,
				response.statusText
			);

			// Check if response body exists
			if (!response.body) {
				let errorMessage =
					"No response body received from server";
				try {
					const errorData =
						await response.json();
					errorMessage =
						errorData.error
							?.message ||
						errorMessage;
				} catch {
					// Response might not be JSON
				}
				throw new Error(errorMessage);
			}

			const responseStream = response.body;
			const reader =
				responseStream.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			let currentEvent = "";

			while (true) {
				const { done, value } =
					await reader.read();

				if (value) {
					buffer += decoder.decode(
						value,
						{ stream: true }
					);
				}

				if (done) {
					// Decode any remaining buffer
					if (buffer.trim()) {
						buffer +=
							decoder.decode(); // Final decode
					}
					break;
				}

				// Process complete lines
				const lines = buffer.split("\n");
				buffer = lines.pop() || ""; // Keep incomplete line in buffer

				for (const line of lines) {
					if (line.trim() === "") {
						// Empty line indicates end of event, reset currentEvent
						currentEvent = "";
						continue;
					}

					// Track event type
					if (
						line.startsWith("event: ")
					) {
						currentEvent = line
							.slice(7)
							.trim();
						continue;
					}

					// Process data lines based on current event
					if (
						line.startsWith("data: ")
					) {
						try {
							const data =
								JSON.parse(
									line.slice(6)
								);
							console.log(
								"AI Service: Parsed SSE data:",
								{
									event: currentEvent,
									data,
								}
							);

							// Handle token events
							if (
								currentEvent ===
									"token" &&
								data.type ===
									"token" &&
								data.fullResponse
							) {
								console.log(
									"AI Service: Yielding token response:",
									data.fullResponse
								);
								yield data.fullResponse;
							}
							// Handle completion events
							else if (
								(currentEvent ===
									"completion" ||
									data.type ===
										"completion") &&
								data.fullResponse
							) {
								console.log(
									"AI Service: Yielding completion response:",
									data.fullResponse
								);
								yield data.fullResponse;
							}
							// Handle error events
							else if (
								data.type ===
								"error"
							) {
								console.error(
									"AI Service: Received error:",
									data.error
								);
								const errorMessage =
									data.error
										?.message ||
									"AI generation failed";
								const errorCode =
									data.error
										?.code ||
									"AI_GENERATION_FAILED";
								const error =
									new Error(
										errorMessage
									) as Error & {
										code?: string;
									};
								error.code =
									errorCode;
								throw error;
							}
						} catch (e) {
							// Skip invalid JSON lines
							console.warn(
								"AI Service: Failed to parse SSE data:",
								line,
								e
							);
						}
					}
				}
			}

			// Process any remaining buffer after stream ends
			if (buffer.trim()) {
				const lines = buffer.split("\n");
				for (const line of lines) {
					if (line.trim() === "")
						continue;
					if (
						line.startsWith("event: ")
					) {
						currentEvent = line
							.slice(7)
							.trim();
						continue;
					}
					if (
						line.startsWith("data: ")
					) {
						try {
							const data =
								JSON.parse(
									line.slice(6)
								);
							if (
								currentEvent ===
									"completion" &&
								data.fullResponse
							) {
								yield data.fullResponse;
							}
						} catch (e) {
							console.warn(
								"AI Service: Failed to parse final buffer:",
								e
							);
						}
					}
				}
			}
		} catch (error) {
			console.error(
				"AI generation failed:",
				error
			);

			// Preserve original error if it's already an Error with a code
			if (
				error instanceof Error &&
				"code" in error
			) {
				throw error;
			}

			// Re-throw the error with additional context
			const errorMessage =
				error instanceof Error
					? error.message
					: "Unknown error occurred";

			const enhancedError = new Error(
				errorMessage.includes(
					"AI service error"
				)
					? errorMessage
					: `AI service error: ${errorMessage}`
			) as Error & {
				code?: string;
				originalError?: unknown;
			};

			// Preserve HTTP status code if available
			if (errorMessage.includes("429")) {
				enhancedError.code =
					"QUOTA_EXCEEDED";
			} else if (
				errorMessage.includes("401")
			) {
				enhancedError.code =
					"AUTHENTICATION_FAILED";
			} else if (
				errorMessage.includes(
					"rate limit"
				) ||
				errorMessage.includes("429")
			) {
				enhancedError.code =
					"RATE_LIMIT_EXCEEDED";
			} else if (
				errorMessage.includes(
					"network"
				) ||
				errorMessage.includes("fetch")
			) {
				enhancedError.code =
					"NETWORK_ERROR";
			} else {
				enhancedError.code =
					"AI_GENERATION_FAILED";
			}

			enhancedError.originalError = error;
			throw enhancedError;
		}
	}

	private async *generateMockResponse(
		options: AIGenerateOptions
	): AsyncIterable<string> {
		const { messages, context } = options;
		const lastMessage =
			messages[messages.length - 1];
		const userInput =
			lastMessage?.content || "";

		// Generate mock response
		const response = this.getMockResponse(
			userInput,
			context
		);

		// Stream the response character by character
		for (
			let i = 0;
			i < response.length;
			i++
		) {
			yield response.slice(0, i + 1);
			await new Promise((resolve) =>
				setTimeout(resolve, 20)
			);
		}
	}

	private getMockResponse(
		input: string,
		context?: AIContext
	): string {
		const lowerInput = input.toLowerCase();

		// Quick action responses
		if (lowerInput.startsWith("/summarize")) {
			return "Here's a summary of your note:\n\n• Key points from your whiteboard boxes\n• Main themes and concepts\n• Action items or next steps\n\nThis is a mock summary. In production, this would analyze your actual note content.";
		}

		if (lowerInput.startsWith("/outline")) {
			return "# Note Outline\n\n## 1. Introduction\n- Overview of main topics\n\n## 2. Key Points\n- Important concepts\n- Supporting details\n\n## 3. Conclusion\n- Summary\n- Next steps\n\nThis is a mock outline. In production, this would create an outline from your note content.";
		}

		if (lowerInput.startsWith("/rewrite")) {
			return "Here's a rewritten version of your content:\n\n*[Rewritten text would appear here based on your selected content]*\n\nThis is a mock rewrite. In production, this would rewrite your selected text.";
		}

		if (lowerInput.startsWith("/todo")) {
			return "## Action Items\n\n- [ ] Review main concepts\n- [ ] Organize notes\n- [ ] Follow up on key points\n- [ ] Schedule next review\n\nThis is a mock todo list. In production, this would extract actionable items from your notes.";
		}

		if (lowerInput.startsWith("/translate")) {
			return "Translation:\n\n*[Translated content would appear here]*\n\nThis is a mock translation. In production, this would translate your selected text.";
		}

		if (lowerInput.startsWith("/insert")) {
			return "I can help you insert content into your note boxes. This would:\n\n• Insert text at your current cursor position\n• Create new boxes with generated content\n• Replace selected text with improved versions\n\nThis is a mock response. In production, I would generate specific content to insert.";
		}

		// General responses
		if (lowerInput.includes("help")) {
			return "I can help you with your whiteboard notes in several ways:\n\n• **Summarize** your notes\n• **Create outlines** from your content\n• **Rewrite** text to improve clarity\n• **Insert** new content into boxes\n• **Generate** todo lists from your notes\n• **Translate** text to other languages\n\nYou can use quick actions by typing commands like /summarize, /outline, /rewrite, etc.";
		}

		if (
			lowerInput.includes("create") ||
			lowerInput.includes("add")
		) {
			return "I can help you create new content for your whiteboard:\n\n• New note boxes with specific topics\n• Structured outlines and frameworks\n• Bullet points and lists\n• Mind maps and concept connections\n\nWhat would you like me to create for you?";
		}

		// Default response
		return `I understand you're asking about: "${input}"\n\n${
			context
				? "Based on your note context, "
				: ""
		}I can help you with various tasks like summarizing, outlining, rewriting content, or creating new material for your whiteboard.\n\nThis is a mock AI response. In production, this would be powered by a real language model like GPT-4, Claude, or similar.`;
	}
}

// Singleton instance
export const aiService = new AIService();
