import { ChatMessage } from "@/state/useAIStore";
import { Note } from "@/state/useWorkspaceStore";
import { apiService } from "./api";

export interface AIContext {
	note?: Note;
	selectedBoxContent?: string;
}

export interface FunctionResultChunk {
	type: "function_result";
	raw: unknown;
	result?: unknown;
}

export type AIStreamChunk =
	| string
	| FunctionResultChunk;

export interface AIGenerateOptions {
	messages: ChatMessage[];
	context?: AIContext;
	includeContext?: boolean;
	model?: string;
	maxTokens?: number;
	temperature?: number;
	stream?: boolean;
}

// SSE Event types
const SSE_EVENTS = {
	TOKEN: "token",
	COMPLETION: "completion",
	FUNCTION_RESULT: "function_result",
	ERROR: "error",
} as const;

// SSE Line prefixes
const SSE_PREFIXES = {
	EVENT: "event: ",
	DATA: "data: ",
} as const;

interface SSEData {
	type?: string;
	fullResponse?: string;
	result?: string | unknown;
	error?: {
		message?: string;
		code?: string;
	};
}

// Real AI service that connects to backend
export class AIService {
	async *generate(
		options: AIGenerateOptions
	): AsyncIterable<AIStreamChunk> {
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

			if (!response.body) {
				const errorMessage =
					await this.extractErrorMessage(
						response
					);
				throw new Error(errorMessage);
			}

			yield* this.parseSSEStream(
				response.body
			);
		} catch (error) {
			throw this.enhanceError(error);
		}
	}

	private async extractErrorMessage(
		response: Response
	): Promise<string> {
		try {
			const errorData =
				await response.json();
			return (
				errorData.error?.message ||
				"No response body received from server"
			);
		} catch {
			return "No response body received from server";
		}
	}

	private async *parseSSEStream(
		stream: ReadableStream<Uint8Array>
	): AsyncIterable<AIStreamChunk> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let currentEvent = "";

		try {
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
					if (buffer.trim()) {
						buffer +=
							decoder.decode(); // Final decode
					}
					break;
				}

				const { lines, remainingBuffer } =
					this.splitLines(buffer);
				buffer = remainingBuffer;

				for (const line of lines) {
					const eventUpdate =
						this.parseEventLine(line);
					if (eventUpdate) {
						currentEvent =
							eventUpdate;
						continue;
					}

					if (line.trim() === "") {
						currentEvent = "";
						continue;
					}

					const chunk =
						this.parseDataLine(
							line,
							currentEvent
						);
					if (chunk) {
						yield chunk;
					}
				}
			}

			// Process remaining buffer
			if (buffer.trim()) {
				const { lines } =
					this.splitLines(buffer);
				let finalEvent = "";

				for (const line of lines) {
					const eventUpdate =
						this.parseEventLine(line);
					if (eventUpdate) {
						finalEvent = eventUpdate;
						continue;
					}

					if (line.trim() === "")
						continue;

					const chunk =
						this.parseDataLine(
							line,
							finalEvent
						);
					if (chunk) {
						yield chunk;
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	private splitLines(buffer: string): {
		lines: string[];
		remainingBuffer: string;
	} {
		const lines = buffer.split("\n");
		const remainingBuffer = lines.pop() || "";
		return { lines, remainingBuffer };
	}

	private parseEventLine(
		line: string
	): string | null {
		if (line.startsWith(SSE_PREFIXES.EVENT)) {
			return line
				.slice(SSE_PREFIXES.EVENT.length)
				.trim();
		}
		return null;
	}

	private parseDataLine(
		line: string,
		currentEvent: string
	): AIStreamChunk | null {
		if (!line.startsWith(SSE_PREFIXES.DATA)) {
			return null;
		}

		try {
			const data: SSEData = JSON.parse(
				line.slice(
					SSE_PREFIXES.DATA.length
				)
			);

			console.log(
				"AI Service: Parsed SSE data:",
				{ event: currentEvent, data }
			);

			// Handle text responses (token or completion)
			if (
				this.isTextEvent(
					currentEvent,
					data
				)
			) {
				if (data.fullResponse) {
					console.log(
						"AI Service: Yielding text response:",
						data.fullResponse.substring(
							0,
							50
						) + "..."
					);
					return data.fullResponse;
				}
			}

			// Handle function results
			if (
				data.type ===
				SSE_EVENTS.FUNCTION_RESULT
			) {
				return this.createFunctionResultChunk(
					data
				);
			}

			// Handle errors
			if (data.type === SSE_EVENTS.ERROR) {
				this.throwSSEError(data);
			}

			return null;
		} catch (error) {
			console.warn(
				"AI Service: Failed to parse SSE data:",
				line,
				error
			);
			return null;
		}
	}

	private isTextEvent(
		event: string,
		data: SSEData
	): boolean {
		return (
			(event === SSE_EVENTS.TOKEN &&
				data.type === SSE_EVENTS.TOKEN) ||
			((event === SSE_EVENTS.COMPLETION ||
				data.type ===
					SSE_EVENTS.COMPLETION) &&
				!!data.fullResponse)
		);
	}

	private createFunctionResultChunk(
		data: SSEData
	): FunctionResultChunk {
		let parsedResult: unknown | undefined;

		try {
			if (typeof data.result === "string") {
				parsedResult = JSON.parse(
					data.result
				);
			} else {
				parsedResult = data.result;
			}
		} catch (parseError) {
			console.warn(
				"AI Service: Failed to parse function result:",
				parseError
			);
		}

		return {
			type: "function_result",
			raw: data,
			result: parsedResult,
		};
	}

	private throwSSEError(data: SSEData): never {
		console.error(
			"AI Service: Received error:",
			data.error
		);

		const errorMessage =
			data.error?.message ||
			"AI generation failed";
		const errorCode =
			data.error?.code ||
			"AI_GENERATION_FAILED";

		const error = new Error(
			errorMessage
		) as Error & { code?: string };
		error.code = errorCode;
		throw error;
	}

	private enhanceError(
		error: unknown
	): Error & {
		code?: string;
		originalError?: unknown;
	} {
		console.error(
			"AI generation failed:",
			error
		);

		// Preserve original error if it already has a code
		if (
			error instanceof Error &&
			"code" in error
		) {
			return error as Error & {
				code?: string;
			};
		}

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

		// Map error messages to error codes
		const errorCodeMap: Array<{
			pattern: string | RegExp;
			code: string;
		}> = [
			{
				pattern: "429",
				code: "QUOTA_EXCEEDED",
			},
			{
				pattern: "401",
				code: "AUTHENTICATION_FAILED",
			},
			{
				pattern: /rate limit|429/i,
				code: "RATE_LIMIT_EXCEEDED",
			},
			{
				pattern: /network|fetch/i,
				code: "NETWORK_ERROR",
			},
		];

		for (const {
			pattern,
			code,
		} of errorCodeMap) {
			if (
				typeof pattern === "string"
					? errorMessage.includes(
							pattern
					  )
					: pattern.test(errorMessage)
			) {
				enhancedError.code = code;
				break;
			}
		}

		if (!enhancedError.code) {
			enhancedError.code =
				"AI_GENERATION_FAILED";
		}

		enhancedError.originalError = error;
		return enhancedError;
	}

	private async *generateMockResponse(
		options: AIGenerateOptions
	): AsyncIterable<string> {
		const lastMessage =
			options.messages[
				options.messages.length - 1
			];
		const userInput =
			(lastMessage?.content as string) ||
			"";

		const response = this.getMockResponse(
			userInput,
			options.context
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
		const quickActions: Record<
			string,
			string
		> = {
			"/summarize":
				"Here's a summary of your note:\n\n• Key points from your whiteboard boxes\n• Main themes and concepts\n• Action items or next steps\n\nThis is a mock summary. In production, this would analyze your actual note content.",
			"/outline":
				"# Note Outline\n\n## 1. Introduction\n- Overview of main topics\n\n## 2. Key Points\n- Important concepts\n- Supporting details\n\n## 3. Conclusion\n- Summary\n- Next steps\n\nThis is a mock outline. In production, this would create an outline from your note content.",
			"/rewrite":
				"Here's a rewritten version of your content:\n\n*[Rewritten text would appear here based on your selected content]*\n\nThis is a mock rewrite. In production, this would rewrite your selected text.",
			"/todo":
				"## Action Items\n\n- [ ] Review main concepts\n- [ ] Organize notes\n- [ ] Follow up on key points\n- [ ] Schedule next review\n\nThis is a mock todo list. In production, this would extract actionable items from your notes.",
			"/translate":
				"Translation:\n\n*[Translated content would appear here]*\n\nThis is a mock translation. In production, this would translate your selected text.",
			"/insert":
				"I can help you insert content into your note boxes. This would:\n\n• Insert text at your current cursor position\n• Create new boxes with generated content\n• Replace selected text with improved versions\n\nThis is a mock response. In production, I would generate specific content to insert.",
		};

		for (const [
			command,
			response,
		] of Object.entries(quickActions)) {
			if (lowerInput.startsWith(command)) {
				return response;
			}
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
		const contextPrefix = context
			? "Based on your note context, "
			: "";
		return `I understand you're asking about: "${input}"\n\n${contextPrefix}I can help you with various tasks like summarizing, outlining, rewriting content, or creating new material for your whiteboard.\n\nThis is a mock AI response. In production, this would be powered by a real language model like GPT-4, Claude, or similar.`;
	}
}

// Singleton instance
export const aiService = new AIService();
