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

export type AIStreamChunk = string | FunctionResultChunk;

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
  requestId?: string;
  payload?: {
    fullResponse?: string;
    token?: string;
    tokenCount?: number;
    result?: unknown;
    error?: {
      message?: string;
      code?: string;
    };
  };
}

const createRequestId = (): string =>
  `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const aiLog = (
  event: "request_start" | "stream_event" | "request_end" | "error",
  payload: Record<string, unknown>,
) => {
  console.log(
    JSON.stringify({
      scope: "ai_client",
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
};

// Real AI service that connects to backend
export class AIService {
  async *generate(options: AIGenerateOptions): AsyncIterable<AIStreamChunk> {
    const {
      messages,
      context,
      model,
      maxTokens,
      temperature,
      stream,
      includeContext,
    } = options;
    const requestId = createRequestId();
    const startedAt = Date.now();

    try {
      aiLog("request_start", {
        requestId,
        messageCount: messages.length,
        hasContext: !!context,
        model: model || "default",
        stream: stream !== false,
      });

      const response = await apiService.generateAI(messages, context, {
        model,
        maxTokens,
        temperature,
        stream,
        includeContext,
      });

      if (!response.body) {
        const errorMessage = await this.extractErrorMessage(response);
        throw new Error(errorMessage);
      }

      for await (const chunk of this.parseSSEStream(response.body, requestId)) {
        yield chunk;
      }

      aiLog("request_end", {
        requestId,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      aiLog("error", {
        requestId,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      });
      throw this.enhanceError(error);
    }
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    try {
      const errorData = await response.json();
      return (
        errorData.error?.message || "No response body received from server"
      );
    } catch {
      return "No response body received from server";
    }
  }

  private async *parseSSEStream(
    stream: ReadableStream<Uint8Array>,
    requestId: string,
  ): AsyncIterable<AIStreamChunk> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        if (done) {
          if (buffer.trim()) {
            buffer += decoder.decode(); // Final decode
          }
          break;
        }

        const { lines, remainingBuffer } = this.splitLines(buffer);
        buffer = remainingBuffer;

        for (const line of lines) {
          const eventUpdate = this.parseEventLine(line);
          if (eventUpdate) {
            currentEvent = eventUpdate;
            continue;
          }

          if (line.trim() === "") {
            currentEvent = "";
            continue;
          }

          const chunk = this.parseDataLine(line, currentEvent, requestId);
          if (chunk) {
            yield chunk;
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const { lines } = this.splitLines(buffer);
        let finalEvent = "";

        for (const line of lines) {
          const eventUpdate = this.parseEventLine(line);
          if (eventUpdate) {
            finalEvent = eventUpdate;
            continue;
          }

          if (line.trim() === "") continue;

          const chunk = this.parseDataLine(line, finalEvent, requestId);
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

  private parseEventLine(line: string): string | null {
    if (line.startsWith(SSE_PREFIXES.EVENT)) {
      return line.slice(SSE_PREFIXES.EVENT.length).trim();
    }
    return null;
  }

  private parseDataLine(
    line: string,
    currentEvent: string,
    requestId: string,
  ): AIStreamChunk | null {
    if (!line.startsWith(SSE_PREFIXES.DATA)) {
      return null;
    }

    try {
      const data: SSEData = JSON.parse(line.slice(SSE_PREFIXES.DATA.length));

      aiLog("stream_event", {
        requestId,
        eventType: currentEvent || data.type || "unknown",
      });

      // Handle text responses (token or completion)
      if (this.isTextEvent(currentEvent, data)) {
        const text = data.payload?.fullResponse;
        if (text) {
          return text;
        }
      }

      // Handle function results
      if (
        currentEvent === SSE_EVENTS.FUNCTION_RESULT &&
        data.type === SSE_EVENTS.FUNCTION_RESULT
      ) {
        return this.createFunctionResultChunk(data);
      }

      // Handle errors
      if (currentEvent === SSE_EVENTS.ERROR && data.type === SSE_EVENTS.ERROR) {
        this.throwSSEError(data);
      }

      return null;
    } catch (error) {
      console.warn("AI Service: Failed to parse SSE data:", line, error);
      return null;
    }
  }

  private isTextEvent(event: string, data: SSEData): boolean {
    return (
      (event === SSE_EVENTS.TOKEN && data.type === SSE_EVENTS.TOKEN) ||
      (event === SSE_EVENTS.COMPLETION &&
        data.type === SSE_EVENTS.COMPLETION &&
        !!data.payload?.fullResponse)
    );
  }

  private createFunctionResultChunk(data: SSEData): FunctionResultChunk {
    let parsedResult: unknown | undefined;

    try {
      const result = data.payload?.result;
      if (typeof result === "string") {
        parsedResult = JSON.parse(result);
      } else {
        parsedResult = result;
      }
    } catch (parseError) {
      console.warn("AI Service: Failed to parse function result:", parseError);
    }

    return {
      type: "function_result",
      raw: data,
      result: parsedResult,
    };
  }

  private throwSSEError(data: SSEData): never {
    console.error("AI Service: Received error:", data.payload?.error);

    const errorMessage = data.payload?.error?.message || "AI generation failed";
    const errorCode = data.payload?.error?.code || "AI_GENERATION_FAILED";

    const error = new Error(errorMessage) as Error & { code?: string };
    error.code = errorCode;
    throw error;
  }

  private enhanceError(error: unknown): Error & {
    code?: string;
    originalError?: unknown;
  } {
    console.error("AI generation failed:", error);

    // Preserve original error if it already has a code
    if (error instanceof Error && "code" in error) {
      return error as Error & {
        code?: string;
      };
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    const enhancedError = new Error(
      errorMessage.includes("AI service error")
        ? errorMessage
        : `AI service error: ${errorMessage}`,
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

    for (const { pattern, code } of errorCodeMap) {
      if (
        typeof pattern === "string"
          ? errorMessage.includes(pattern)
          : pattern.test(errorMessage)
      ) {
        enhancedError.code = code;
        break;
      }
    }

    if (!enhancedError.code) {
      enhancedError.code = "AI_GENERATION_FAILED";
    }

    enhancedError.originalError = error;
    return enhancedError;
  }
}

// Singleton instance
export const aiService = new AIService();
