export const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ||
	"http://localhost:3001/api/v1";

export const apiConfig = {
	baseURL: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
};

export const WS_URL =
	import.meta.env.VITE_WS_URL ||
	"ws://localhost:3001/ws";
export const WS_ENABLED =
	(import.meta.env.VITE_WS_ENABLED ||
		"true") === "true";
