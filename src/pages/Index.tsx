import React, {
	useEffect,
	useState,
} from "react";
import { Canvas } from "@/components/Canvas";
import { LeftSidebar } from "@/components/sidebar/LeftSidebar";
import { RightSidebarChat } from "@/components/sidebar/RightSidebarChat";
import { GlobalToolbar } from "@/components/GlobalToolbar";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";
import { useAIStore } from "@/state/useAIStore";
import { testBackendConnection } from "@/utils/testBackendConnection";
import {
	useNavigate,
	useParams,
} from "react-router-dom";
import { useBoardStore } from "@/state/useBoardStore";
import { apiService } from "@/services/api";
import type { Box } from "@/state/useWorkspaceStore";

interface ToolbarCallbacks {
	[key: string]: () => void;
}

const Index = () => {
	const [
		toolbarCallbacks,
		setToolbarCallbacks,
	] = useState<ToolbarCallbacks>({});
	const navigate = useNavigate();
	const params = useParams();

	const {
		leftSidebarOpen,
		leftSidebarWidth,
		setLeftSidebarWidth,
		toggleLeftSidebar,
		loadFromStorage: loadWorkspace,
		loadFromBackend,
		setActiveNote,
		workspace,
		createCollection,
		createNote,
	} = useWorkspaceStore();

	const {
		rightSidebarOpen,
		rightSidebarWidth,
		setRightSidebarWidth,
		toggleRightSidebar,
		loadFromStorage: loadAI,
	} = useAIStore();

	const { loadNote } = useBoardStore();

	const handleCreateNote = async () => {
		try {
			// Create a note in the first available collection
			const collectionId = Object.keys(
				workspace.collections
			)[0];
			if (collectionId) {
				const noteId = await createNote(
					collectionId,
					"New Note"
				);
				// Navigate to the new note
				navigate(`/notes/${noteId}`);
			} else {
				// If no collections exist, create one first
				const newCollectionId =
					await createCollection(
						"My Notes"
					);
				const noteId = await createNote(
					newCollectionId,
					"New Note"
				);
				navigate(`/notes/${noteId}`);
			}
		} catch (error) {
			console.error(
				"Failed to create note:",
				error
			);
		}
	};

	const handleCreateCollection = async () => {
		const name = prompt("Collection name:");
		if (name?.trim()) {
			try {
				await createCollection(
					name.trim()
				);
			} catch (error) {
				console.error(
					"Failed to create collection:",
					error
				);
			}
		}
	};

	// Load data on mount
	useEffect(() => {
		const loadData = async () => {
			try {
				// Test backend connection first
				const isBackendAvailable =
					await testBackendConnection();

				if (isBackendAvailable) {
					// Try to load from backend
					await loadFromBackend();
					console.log(
						"✅ Loaded data from backend"
					);
				} else {
					console.log(
						"⚠️ Backend not available, falling back to local storage"
					);
					loadWorkspace();
				}
			} catch (error) {
				console.log(
					"⚠️ Backend not available, falling back to local storage"
				);
				loadWorkspace();
			}
			loadAI();

			// After data is loaded, if URL has noteId, set it active
			const noteId = params.noteId;
			if (noteId) {
				// Find the collection containing this note
				const collections =
					useWorkspaceStore.getState()
						.workspace.collections;
				for (const [
					collectionId,
					col,
				] of Object.entries(
					collections
				)) {
					if (col.notes[noteId]) {
						setActiveNote(
							collectionId,
							noteId
						);
						// Fetch fresh content
						try {
							const res =
								await apiService.getNote(
									noteId
								);
							const data =
								await res.json();
							const n =
								col.notes[noteId];
							loadNote(
								(data.content as Box[]) ||
									[],
								{
									scale: n.zoom,
									x: n.pan.x,
									y: n.pan.y,
								}
							);
						} catch (error) {
							console.error(
								"Failed to load note:",
								error
							);
						}
						break;
					}
				}
			}
		};

		loadData();
	}, [
		loadFromBackend,
		loadWorkspace,
		loadAI,
		params.noteId,
		setActiveNote,
		loadNote,
	]);

	// Keep URL in sync when active note changes
	useEffect(() => {
		const { noteId } = workspace.active;
		if (noteId) {
			navigate(`/notes/${noteId}`, {
				replace: true,
			});
		} else {
			// If no active note, navigate to /app
			navigate("/app", { replace: true });
		}
	}, [workspace.active, navigate]);

	// Global keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (
			e: KeyboardEvent
		) => {
			if (e.ctrlKey || e.metaKey) {
				if (e.key === "k") {
					e.preventDefault();
					const searchInput =
						document.querySelector(
							'[placeholder="Search notes..."]'
						) as HTMLInputElement;
					searchInput?.focus();
				} else if (e.key === "/") {
					e.preventDefault();
					toggleRightSidebar();
				}
			}
		};

		document.addEventListener(
			"keydown",
			handleKeyDown
		);
		return () =>
			document.removeEventListener(
				"keydown",
				handleKeyDown
			);
	}, [toggleRightSidebar]);

	// Check if we have an active note
	const hasActiveNote = workspace.active.noteId;

	return (
		<div className="flex flex-col h-screen w-full bg-background">
			{/* Global Toolbar - spans full width */}
			<GlobalToolbar
				leftSidebarOpen={leftSidebarOpen}
				rightSidebarOpen={
					rightSidebarOpen
				}
				onToggleLeftSidebar={
					toggleLeftSidebar
				}
				onToggleRightSidebar={
					toggleRightSidebar
				}
				{...toolbarCallbacks}
			/>

			{/* Body with sidebars and main content */}
			<div className="flex flex-1 min-h-0 overflow-hidden">
				{/* Left Sidebar */}
				<div
					className={`transition-all duration-300 ease-out ${
						leftSidebarOpen
							? "w-auto"
							: "w-0"
					} overflow-hidden`}>
					{leftSidebarOpen && (
						<LeftSidebar
							width={
								leftSidebarWidth
							}
							onResize={
								setLeftSidebarWidth
							}
						/>
					)}
				</div>

				{/* Main Content */}
				<div className="flex-1 flex flex-col min-w-0">
					{hasActiveNote ? (
						<Canvas
							onToolbarCallbacksChange={
								setToolbarCallbacks
							}
						/>
					) : (
						<div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted relative">
							<div className="text-center max-w-3xl mx-auto px-8">
								<div className="flex items-center justify-center mb-10">
									<div className="h-24 w-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center shadow-lg">
										<svg
											className="h-12 w-12 text-primary"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={
													1.5
												}
												d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
											/>
										</svg>
									</div>
								</div>
								<h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
									Welcome to
									Your Workspace
								</h1>
								<p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-2xl mx-auto">
									Select a note
									from the
									sidebar to
									start editing,
									or create a
									new note to
									begin
									organizing
									your thoughts
									on the
									infinite
									canvas.
								</p>

								{/* Quick Actions */}
								<div className="grid md:grid-cols-2 gap-6 mb-12 max-w-2xl mx-auto">
									<button
										onClick={
											handleCreateNote
										}
										className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
										<div className="flex items-center justify-center mb-4">
											<div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
												<svg
													className="h-6 w-6 text-primary"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24">
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={
															2
														}
														d="M12 6v6m0 0v6m0-6h6m-6 0H6"
													/>
												</svg>
											</div>
										</div>
										<h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
											Create
											New
											Note
										</h3>
										<p className="text-sm text-muted-foreground">
											Start
											a new
											note
											and
											begin
											organizing
											your
											thoughts
										</p>
									</button>

									<button
										onClick={
											handleCreateCollection
										}
										className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
										<div className="flex items-center justify-center mb-4">
											<div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
												<svg
													className="h-6 w-6 text-primary"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24">
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={
															2
														}
														d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
													/>
												</svg>
											</div>
										</div>
										<h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
											Create
											Collection
										</h3>
										<p className="text-sm text-muted-foreground">
											Organize
											your
											notes
											into
											collections
											for
											better
											structure
										</p>
									</button>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Right Sidebar */}
				<div
					className={`transition-all duration-300 ease-out ${
						rightSidebarOpen
							? "w-auto"
							: "w-0"
					} overflow-hidden`}>
					{rightSidebarOpen && (
						<RightSidebarChat
							width={
								rightSidebarWidth
							}
							onResize={
								setRightSidebarWidth
							}
						/>
					)}
				</div>
			</div>
		</div>
	);
};

export default Index;
