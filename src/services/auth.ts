import { apiService } from "./api";

export interface AuthenticatedUser {
	id: string;
	email: string;
	name: string;
	token: string;
}

const normalizeErrorMessage = (
	errorBody: unknown,
	fallbackMessage: string
): string => {
	if (errorBody == null) {
		return fallbackMessage;
	}

	if (typeof errorBody === "string") {
		return errorBody;
	}

	if (
		Array.isArray(errorBody) &&
		errorBody.length > 0
	) {
		const combined = errorBody
			.map((item) =>
				normalizeErrorMessage(item, "")
			)
			.filter(Boolean)
			.join(" ")
			.trim();

		return combined || fallbackMessage;
	}

	if (
		typeof errorBody === "object" &&
		errorBody !== null &&
		typeof errorBody === "object"
	) {
		const recordBody = errorBody as Record<
			string,
			unknown
		>;

		if (
			typeof recordBody.message === "string"
		) {
			return (
				recordBody.message ||
				fallbackMessage
			);
		}
		if (Array.isArray(recordBody.message)) {
			return normalizeErrorMessage(
				recordBody.message,
				fallbackMessage
			);
		}
		if (
			typeof recordBody.error === "string"
		) {
			return (
				recordBody.error ||
				fallbackMessage
			);
		}
		if (
			Array.isArray(recordBody.error) &&
			recordBody.error.length > 0
		) {
			return normalizeErrorMessage(
				recordBody.error,
				fallbackMessage
			);
		}
		const issueMessage = (
			recordBody.issues as
				| Array<{
						message?: unknown;
				  }>
				| undefined
		)?.[0]?.message?.toString?.();
		if (typeof issueMessage === "string") {
			return (
				issueMessage.trim() ||
				fallbackMessage
			);
		}
	}

	return fallbackMessage;
};

const parseAuthResponse = async (
	response: Response,
	fallbackMessage: string
): Promise<AuthenticatedUser> => {
	if (!response.ok) {
		let message = fallbackMessage;
		const status = response.status;
		const errorBody = await response
			.json()
			.catch(() => null);

		if (status === 404) {
			message =
				"Authentication service is currently unavailable. Please try again soon.";
		} else if (status >= 500) {
			message =
				"Something went wrong. Please try again shortly.";
		} else if (errorBody) {
			message = normalizeErrorMessage(
				errorBody,
				fallbackMessage
			);
		}

		throw new Error(message);
	}

	const data = await response.json();
	if (!data?.user || !data?.token) {
		throw new Error(
			"Invalid authentication response."
		);
	}
	return {
		id: data.user.id,
		email: data.user.email,
		name: data.user.name || "User",
		token: data.token,
	};
};

const loginWithEmail = async (payload: {
	email: string;
	password: string;
}): Promise<AuthenticatedUser> => {
	try {
		const response = await apiService.post(
			"/auth/login",
			payload
		);
		return await parseAuthResponse(
			response,
			"Invalid email or password."
		);
	} catch (error) {
		if (error instanceof Error) {
			const message = error.message
				.toLowerCase()
				.includes("fetch")
				? "We couldn't reach the server. Check your connection and try again."
				: error.message;
			throw new Error(message);
		}
		throw new Error(
			"Unable to login right now. Please try again."
		);
	}
};

const registerWithEmail = async (payload: {
	name: string;
	email: string;
	password: string;
	confirmPassword?: string;
}): Promise<AuthenticatedUser> => {
	try {
		const response = await apiService.post(
			"/auth/register",
			payload
		);
		return await parseAuthResponse(
			response,
			"Unable to create account. Please try again."
		);
	} catch (error) {
		if (error instanceof Error) {
			const message = error.message
				.toLowerCase()
				.includes("fetch")
				? "We couldn't reach the server. Check your connection and try again."
				: error.message;
			throw new Error(message);
		}
		throw new Error(
			"Unable to create account. Please try again."
		);
	}
};

const loginWithGoogle =
	async (): Promise<AuthenticatedUser> => {
		throw new Error(
			"Google login is coming soon. Please use email and password."
		);
	};

export const authService = {
	loginWithEmail,
	registerWithEmail,
	loginWithGoogle,
};
