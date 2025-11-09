import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	authService,
	type AuthenticatedUser,
} from "@/services/auth";

interface AuthState {
	isLoggedIn: boolean;
	user: AuthenticatedUser | null;
	isLoading: boolean;
	error: string | null;
}

interface AuthActions {
	loginWithEmail: (credentials: {
		email: string;
		password: string;
	}) => Promise<void>;
	registerWithEmail: (data: {
		name: string;
		email: string;
		password: string;
	}) => Promise<void>;
	loginWithGoogle: () => Promise<void>;
	logout: () => void;
	clearError: () => void;
	loginAsDemo: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
	isLoggedIn: false,
	user: null,
	isLoading: false,
	error: null,
};

export const useAuthStore = create<AuthStore>()(
	persist(
		(set) => ({
			...initialState,

			clearError: () =>
				set({ error: null }),

			loginWithEmail: async ({
				email,
				password,
			}) => {
				set({
					isLoading: true,
					error: null,
				});
				try {
					const user =
						await authService.loginWithEmail(
							{
								email,
								password,
							}
						);
					set({
						isLoggedIn: true,
						user,
						isLoading: false,
					});
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "Login failed. Please try again.";
					set({
						error: message,
						isLoading: false,
					});
					throw error;
				}
			},

			registerWithEmail: async ({
				name,
				email,
				password,
			}) => {
				set({
					isLoading: true,
					error: null,
				});
				try {
					const user =
						await authService.registerWithEmail(
							{
								name,
								email,
								password,
							}
						);
					set({
						isLoggedIn: true,
						user,
						isLoading: false,
					});
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "Sign up failed. Please try again.";
					set({
						error: message,
						isLoading: false,
					});
					throw error;
				}
			},

			loginWithGoogle: async () => {
				set({
					isLoading: true,
					error: null,
				});
				try {
					const user =
						await authService.loginWithGoogle();
					set({
						isLoggedIn: true,
						user,
						isLoading: false,
					});
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "Google login is not available right now.";
					set({
						error: message,
						isLoading: false,
					});
					throw error;
				}
			},

			loginAsDemo: () => {
				set({
					isLoggedIn: true,
					user: {
						id: "demo-user",
						email: "demo@example.com",
						name: "Demo User",
						token: "demo-token",
					},
					isLoading: false,
					error: null,
				});
			},

			logout: () => {
				set({
					isLoggedIn: false,
					user: null,
					isLoading: false,
					error: null,
				});
				localStorage.removeItem(
					"whiteboard.workspace.v1"
				);
				localStorage.removeItem(
					"whiteboard.ai.v1"
				);
			},
		}),
		{
			name: "whiteboard.auth.v1",
			partialize: (state) => ({
				isLoggedIn: state.isLoggedIn,
				user: state.user,
			}),
		}
	)
);
