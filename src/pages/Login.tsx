import React, { useState } from "react";
import {
	Link,
	useNavigate,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	PenTool,
	Eye,
	EyeOff,
	Mail,
	Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/state/useAuthStore";

const Login = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] =
		useState(false);
	const [isLoading, setIsLoading] =
		useState(false);
	const navigate = useNavigate();
	const { toast } = useToast();
	const { login } = useAuthStore();

	const handleSubmit = async (
		e: React.FormEvent
	) => {
		e.preventDefault();
		setIsLoading(true);

		// Simulate login process
		setTimeout(() => {
			if (email && password) {
				// Login user
				login({
					id: "user-123",
					email: email,
					name: email.split("@")[0],
				});
				toast({
					title: "Welcome back!",
					description:
						"You've been successfully logged in.",
				});
				navigate("/app");
			} else {
				toast({
					title: "Login failed",
					description:
						"Please enter valid credentials.",
					variant: "destructive",
				});
			}
			setIsLoading(false);
		}, 1000);
	};

	const handleDemoLogin = () => {
		// Login as demo user
		login({
			id: "demo-user",
			email: "demo@example.com",
			name: "Demo User",
		});
		navigate("/app");
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-6">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<Link
						to="/"
						className="inline-flex items-center space-x-2 text-2xl font-bold">
						<PenTool className="h-8 w-8 text-primary" />
						<span>
							Whiteboard Notes
						</span>
					</Link>
				</div>

				<Card className="shadow-lg">
					<CardHeader className="text-center">
						<CardTitle className="text-2xl">
							Welcome back
						</CardTitle>
						<CardDescription>
							Sign in to your
							account to continue
							organizing your ideas
						</CardDescription>
					</CardHeader>

					<CardContent>
						<form
							onSubmit={
								handleSubmit
							}
							className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="email">
									Email
								</Label>
								<div className="relative">
									<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										id="email"
										type="email"
										placeholder="Enter your email"
										value={
											email
										}
										onChange={(
											e
										) =>
											setEmail(
												e
													.target
													.value
											)
										}
										className="pl-10"
										required
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="password">
									Password
								</Label>
								<div className="relative">
									<Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										id="password"
										type={
											showPassword
												? "text"
												: "password"
										}
										placeholder="Enter your password"
										value={
											password
										}
										onChange={(
											e
										) =>
											setPassword(
												e
													.target
													.value
											)
										}
										className="pl-10 pr-10"
										required
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
										onClick={() =>
											setShowPassword(
												!showPassword
											)
										}>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>

							<div className="flex items-center justify-between text-sm">
								<label className="flex items-center space-x-2">
									<input
										type="checkbox"
										className="rounded border border-input"
									/>
									<span>
										Remember
										me
									</span>
								</label>
								<Link
									to="#"
									className="text-primary hover:underline">
									Forgot
									password?
								</Link>
							</div>

							<Button
								type="submit"
								className="w-full"
								disabled={
									isLoading
								}>
								{isLoading
									? "Signing in..."
									: "Sign In"}
							</Button>
						</form>

						<div className="mt-6">
							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<Separator className="w-full" />
								</div>
								<div className="relative flex justify-center text-xs uppercase">
									<span className="bg-background px-2 text-muted-foreground">
										Or
									</span>
								</div>
							</div>

							<Button
								variant="outline"
								className="w-full mt-4"
								onClick={
									handleDemoLogin
								}>
								<PenTool className="mr-2 h-4 w-4" />
								Try Demo (No Login
								Required)
							</Button>
						</div>

						{/* Social Login Options */}
						<div className="mt-4 space-y-2">
							<Button
								variant="outline"
								className="w-full">
								<svg
									className="mr-2 h-4 w-4"
									viewBox="0 0 24 24">
									<path
										fill="currentColor"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="currentColor"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="currentColor"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="currentColor"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
								Continue with
								Google
							</Button>

							<Button
								variant="outline"
								className="w-full">
								<svg
									className="mr-2 h-4 w-4"
									fill="currentColor"
									viewBox="0 0 24 24">
									<path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
								</svg>
								Continue with
								Twitter
							</Button>
						</div>
					</CardContent>

					<CardFooter className="text-center">
						<p className="text-sm text-muted-foreground">
							Don't have an account?{" "}
							<Link
								to="/signup"
								className="text-primary hover:underline font-medium">
								Sign up for free
							</Link>
						</p>
					</CardFooter>
				</Card>

				<div className="mt-8 text-center">
					<Link
						to="/"
						className="text-sm text-muted-foreground hover:text-foreground transition-colors">
						← Back to home
					</Link>
				</div>
			</div>
		</div>
	);
};

export default Login;
