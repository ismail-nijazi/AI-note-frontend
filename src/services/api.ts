import { apiConfig } from "@/config/api";
import { AIContext } from "./ai";
import { ChatMessage } from "@/state/useAIStore";
import { NoteBox } from "@/state/useBoardStore";

class ApiService {
	private async request(
		endpoint: string,
		options: RequestInit = {}
	): Promise<Response> {
		const url = `${apiConfig.baseURL}${endpoint}`;
		const config: RequestInit = {
			...options,
			headers: {
				...apiConfig.headers,
				...options.headers,
			},
		};

		try {
			const response = await fetch(
				url,
				config
			);

			if (!response.ok) {
				throw new Error(
					`HTTP error! status: ${response.status}`
				);
			}

			return response;
		} catch (error) {
			console.error(
				"API request failed:",
				error
			);
			throw error;
		}
	}

	// AI endpoints
	async generateAI(
		messages: ChatMessage[],
		context?: AIContext,
		options?: {
			model?: string;
			maxTokens?: number;
			temperature?: number;
			stream?: boolean;
		}
	): Promise<Response> {
		// Transform messages to backend format: only role and content, filter empty content
		const transformedMessages = messages
			.map((msg) => ({
				role: msg.role,
				content:
					msg.content?.trim() || "",
			}))
			.filter(
				(msg) => msg.content.length > 0
			); // Remove messages with empty content

		if (transformedMessages.length === 0) {
			throw new Error(
				"No valid messages to send"
			);
		}

		const response = await fetch(
			`${apiConfig.baseURL}/ai/generate`,
			{
				method: "POST",
				headers: apiConfig.headers,
				body: JSON.stringify({
					messages: transformedMessages,
					context,
					includeContext: true,
					model:
						options?.model ||
						"gpt-3.5-turbo",
					maxTokens:
						options?.maxTokens ||
						1000,
					temperature:
						options?.temperature ||
						0.7,
					stream:
						options?.stream !== false, // default to true
				}),
			}
		);

		if (!response.ok) {
			let errorMessage = `AI generation failed: ${response.status}`;
			let errorCode =
				"AI_GENERATION_FAILED";

			try {
				// Try to extract error message from response body
				const contentType =
					response.headers.get(
						"content-type"
					);
				if (
					contentType?.includes(
						"application/json"
					)
				) {
					const errorData =
						await response.json();
					errorMessage =
						errorData.error
							?.message ||
						errorData.message ||
						errorMessage;
					errorCode =
						errorData.error?.code ||
						errorCode;
				} else {
					const text =
						await response.text();
					if (text) {
						errorMessage = text;
					}
				}
			} catch {
				// If we can't parse the error, use the status-based message
			}

			const error = new Error(
				errorMessage
			) as Error & {
				code?: string;
				status?: number;
			};
			error.code = errorCode;
			error.status = response.status;
			throw error;
		}

		return response;
	}

	async getAIModels(): Promise<Response> {
		return this.request("/ai/models");
	}

	async getAIHealth(): Promise<Response> {
		return this.request("/ai/health");
	}

	// Notes endpoints
	async getNotes(params?: {
		page?: number;
		limit?: number;
		collectionId?: string;
		sortBy?: string;
		sortOrder?: string;
	}): Promise<Response> {
		const query = new URLSearchParams();
		if (params?.page)
			query.append(
				"page",
				params.page.toString()
			);
		if (params?.limit)
			query.append(
				"limit",
				params.limit.toString()
			);
		if (params?.collectionId)
			query.append(
				"collectionId",
				params.collectionId
			);
		if (params?.sortBy)
			query.append("sortBy", params.sortBy);
		if (params?.sortOrder)
			query.append(
				"sortOrder",
				params.sortOrder
			);

		return this.request(
			`/notes?${query.toString()}`
		);
	}

	async getNote(id: string): Promise<Response> {
		return this.request(`/notes/${id}`);
	}

	async createNote(note: {
		title: string;
		content: NoteBox[];
		collectionId?: string;
	}): Promise<Response> {
		return this.request("/notes", {
			method: "POST",
			body: JSON.stringify(note),
		});
	}

	async updateNote(
		id: string,
		note: {
			title?: string;
			content?: NoteBox[];
			version: number;
		}
	): Promise<Response> {
		return this.request(`/notes/${id}`, {
			method: "PUT",
			body: JSON.stringify(note),
		}).catch((e) => {
			console.log("e", e);
			throw e;
		});
	}

	async deleteNote(
		id: string
	): Promise<Response> {
		return this.request(`/notes/${id}`, {
			method: "DELETE",
		});
	}

	async duplicateNote(
		id: string,
		data?: {
			title?: string;
			collectionId?: string;
		}
	): Promise<Response> {
		return this.request(
			`/notes/${id}/duplicate`,
			{
				method: "POST",
				body: JSON.stringify(data || {}),
			}
		);
	}

	// Collections endpoints
	async getCollections(params?: {
		page?: number;
		limit?: number;
	}): Promise<Response> {
		const query = new URLSearchParams();
		if (params?.page)
			query.append(
				"page",
				params.page.toString()
			);
		if (params?.limit)
			query.append(
				"limit",
				params.limit.toString()
			);

		return this.request(
			`/collections?${query.toString()}`
		);
	}

	async getCollection(
		id: string
	): Promise<Response> {
		return this.request(`/collections/${id}`);
	}

	async createCollection(collection: {
		name: string;
		description?: string;
		color?: string;
	}): Promise<Response> {
		return this.request("/collections", {
			method: "POST",
			body: JSON.stringify(collection),
		});
	}

	async updateCollection(
		id: string,
		collection: {
			name?: string;
			description?: string;
			color?: string;
		}
	): Promise<Response> {
		return this.request(
			`/collections/${id}`,
			{
				method: "PUT",
				body: JSON.stringify(collection),
			}
		);
	}

	async deleteCollection(
		id: string
	): Promise<Response> {
		return this.request(
			`/collections/${id}`,
			{
				method: "DELETE",
			}
		);
	}

	// Media endpoints
	async getMedia(params?: {
		noteId?: string;
		page?: number;
		limit?: number;
	}): Promise<Response> {
		const query = new URLSearchParams();
		if (params?.noteId)
			query.append("noteId", params.noteId);
		if (params?.page)
			query.append(
				"page",
				params.page.toString()
			);
		if (params?.limit)
			query.append(
				"limit",
				params.limit.toString()
			);

		return this.request(
			`/media?${query.toString()}`
		);
	}

	async getMediaFile(
		id: string
	): Promise<Response> {
		return this.request(`/media/${id}`);
	}

	async deleteMediaFile(
		id: string
	): Promise<Response> {
		return this.request(`/media/${id}`, {
			method: "DELETE",
		});
	}
}

export const apiService = new ApiService();
