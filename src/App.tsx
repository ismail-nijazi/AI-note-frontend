import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import {
	BrowserRouter,
	Routes,
	Route,
} from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import AuthGuard from "./components/AuthGuard";

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<TooltipProvider>
			<Toaster />
			<Sonner />
			<BrowserRouter>
				<AuthGuard>
					<Routes>
						<Route
							path="/"
							element={<Landing />}
						/>
						<Route
							path="/login"
							element={<Login />}
						/>
						<Route
							path="/signup"
							element={<Signup />}
						/>
						<Route
							path="/app"
							element={<Index />}
						/>
						<Route
							path="/notes/:noteId"
							element={<Index />}
						/>
						<Route
							path="/settings"
							element={<Settings />}
						/>
						{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
						<Route
							path="*"
							element={<NotFound />}
						/>
					</Routes>
				</AuthGuard>
			</BrowserRouter>
		</TooltipProvider>
	</QueryClientProvider>
);

export default App;
