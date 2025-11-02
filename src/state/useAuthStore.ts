import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
	isLoggedIn: boolean;
	user: {
		id: string;
		email: string;
		name: string;
	} | null;
}

interface AuthActions {
	login: (user: {
		id: string;
		email: string;
		name: string;
	}) => void;
	logout: () => void;
	setLoggedIn: (isLoggedIn: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
	isLoggedIn: false,
	user: null,
};

export const useAuthStore = create<AuthStore>()(
	persist(
		(set, get) => ({
			...initialState,

			login: (user) => {
				set({
					isLoggedIn: true,
					user,
				});
			},

			logout: () => {
				set({
					isLoggedIn: false,
					user: null,
				});
				// Clear workspace data on logout
				localStorage.removeItem(
					"whiteboard.workspace.v1"
				);
				localStorage.removeItem(
					"whiteboard.ai.v1"
				);
			},

			setLoggedIn: (isLoggedIn) => {
				set({ isLoggedIn });
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
