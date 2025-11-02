import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/state/useAuthStore";

interface AuthGuardProps {
	children: React.ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
	const navigate = useNavigate();
	const location = useLocation();
	const { isLoggedIn } = useAuthStore();

	useEffect(() => {
		// If user is logged in and trying to access auth pages, redirect to /app
		if (isLoggedIn && (location.pathname === "/" || location.pathname === "/login" || location.pathname === "/signup")) {
			navigate("/app", { replace: true });
		}
		// If user is not logged in and trying to access protected pages, redirect to home
		else if (!isLoggedIn && (location.pathname === "/app" || location.pathname.startsWith("/notes/"))) {
			navigate("/", { replace: true });
		}
	}, [isLoggedIn, location.pathname, navigate]);

	return <>{children}</>;
};

export default AuthGuard;
