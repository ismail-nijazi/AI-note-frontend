import React, {
	useRef,
	useEffect,
	useState,
	useCallback,
} from "react";
import { useBoardStore } from "@/state/useBoardStore";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";
import { useAIStore } from "@/state/useAIStore";
import { apiService } from "@/services/api";
import { NoteBox } from "./note-box/NoteBox";
import { GlobalToolbar } from "./GlobalToolbar";
import { socketService } from "@/services/socket";

type ToolbarCallbacks = Record<
	string,
	(...args: unknown[]) => void
>;

interface CanvasProps {
	onToolbarCallbacksChange?: (
		callbacks: ToolbarCallbacks
	) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
	onToolbarCallbacksChange,
}) => {
	const {
		noteBoxes,
		selectedBoxId,
		editingBoxId,
		canvasTransform,
		addNoteBox,
		selectNoteBox,
		setEditingBox,
		updateCanvasTransform,
		loadFromStorage,
		saveToStorage,
		syncNoteToBackend,
	} = useBoardStore();

	const {
		getCurrentNote,
		updateNote,
		workspace,
		leftSidebarOpen,
	} = useWorkspaceStore();
	const { rightSidebarOpen } = useAIStore();

	const canvasRef =
		useRef<HTMLDivElement>(null);
	const [isPanning, setIsPanning] =
		useState(false);
	const [lastPanPoint, setLastPanPoint] =
		useState({ x: 0, y: 0 });
	const [
		toolbarCallbacks,
		setToolbarCallbacks,
	] = useState<ToolbarCallbacks>({});

	// Track last saved snapshot to avoid redundant periodic saves
	const lastSavedHashRef = useRef<
		string | null
	>(null);

	const buildSnapshotHash = useCallback(() => {
		// Only include fields persisted to backend
		const boxes = noteBoxes.map((b) => ({
			id: b.id,
			x: b.x,
			y: b.y,
			width: b.width,
			height: b.height,
			zIndex: b.zIndex,
			content: b.content,
		}));
		const payload = {
			boxes,
			zoom: canvasTransform.scale,
			pan: {
				x: canvasTransform.x,
				y: canvasTransform.y,
			},
		};
		return JSON.stringify(payload);
	}, [noteBoxes, canvasTransform]);

	const saveCurrentNoteNow =
		useCallback(async () => {
			const currentNote = getCurrentNote();
			if (
				currentNote &&
				workspace.active.collectionId &&
				workspace.active.noteId
			) {
				try {
					// Update local state only
					await updateNote(
						workspace.active
							.collectionId,
						workspace.active.noteId,
						{
							boxes: noteBoxes.map(
								(box) => ({
									id: box.id,
									x: box.x,
									y: box.y,
									width: box.width,
									height: box.height,
									zIndex: box.zIndex,
									content:
										box.content,
								})
							),
							zoom: canvasTransform.scale,
							pan: {
								x: canvasTransform.x,
								y: canvasTransform.y,
							},
						}
					);

					// Backend sync (skips when offline inside the hook)
					await syncNoteToBackend(
						workspace.active.noteId
					);

					// Update last saved hash on success
					lastSavedHashRef.current =
						buildSnapshotHash();
				} catch (error) {
					console.error(
						"Failed to save note:",
						error
					);
				}
			}
		}, [
			getCurrentNote,
			workspace.active,
			noteBoxes,
			canvasTransform,
			updateNote,
			syncNoteToBackend,
			buildSnapshotHash,
		]);

	// Notify parent when toolbar callbacks change
	useEffect(() => {
		if (onToolbarCallbacksChange) {
			onToolbarCallbacksChange(
				toolbarCallbacks
			);
		}
	}, [
		toolbarCallbacks,
		onToolbarCallbacksChange,
	]);

	// Load data on mount
	useEffect(() => {
		loadFromStorage();
		// Establish WS connection early
		socketService.connect();
	}, [loadFromStorage]);

	// Auto-save current note state (debounced on changes)
	useEffect(() => {
		let timeout: ReturnType<
			typeof setTimeout
		> | null = null;

		// Debounce 1000ms after last change
		if (timeout)
			clearTimeout(
				timeout as unknown as number
			);
		timeout = setTimeout(
			saveCurrentNoteNow,
			1000
		);

		return () => {
			if (timeout)
				clearTimeout(
					timeout as unknown as number
				);
		};
	}, [
		noteBoxes,
		canvasTransform,
		saveCurrentNoteNow,
	]);

	// Periodic autosave every 15s if there are unsaved changes
	useEffect(() => {
		const interval = setInterval(() => {
			if (
				typeof navigator !==
					"undefined" &&
				navigator &&
				navigator.onLine === false
			) {
				return;
			}
			const currentHash =
				buildSnapshotHash();
			if (
				lastSavedHashRef.current !==
				currentHash
			) {
				void saveCurrentNoteNow();
			}
		}, 15000);
		return () => clearInterval(interval);
	}, [buildSnapshotHash, saveCurrentNoteNow]);

	// Convert screen coordinates to canvas coordinates
	const screenToCanvas = useCallback(
		(screenX: number, screenY: number) => {
			const canvasRect =
				canvasRef.current?.getBoundingClientRect();
			if (!canvasRect)
				return { x: screenX, y: screenY };

			return {
				x:
					(screenX -
						canvasRect.left -
						canvasTransform.x) /
					canvasTransform.scale,
				y:
					(screenY -
						canvasRect.top -
						canvasTransform.y) /
					canvasTransform.scale,
			};
		},
		[canvasTransform]
	);

	const handleDoubleClick = (
		e: React.MouseEvent
	) => {
		e.preventDefault();
		const canvasPos = screenToCanvas(
			e.clientX,
			e.clientY
		);
		addNoteBox(canvasPos.x, canvasPos.y);
	};

	const handleMouseDown = (
		e: React.MouseEvent
	) => {
		if (
			e.button === 0 &&
			e.target === canvasRef.current
		) {
			// Clear selection and unfocus any editing text box when clicking on empty canvas
			selectNoteBox(null);
			setEditingBox(null);
			setToolbarCallbacks({});

			// Start panning when clicking on empty canvas
			setIsPanning(true);
			setLastPanPoint({
				x: e.clientX,
				y: e.clientY,
			});
			e.preventDefault();
		} else if (
			e.button === 0 &&
			(e.ctrlKey || e.metaKey || e.shiftKey)
		) {
			// Start panning with Ctrl/Cmd/Shift + left click (backup method)
			setIsPanning(true);
			setLastPanPoint({
				x: e.clientX,
				y: e.clientY,
			});
			e.preventDefault();
		}
	};

	const handleMouseMove = (
		e: React.MouseEvent
	) => {
		if (isPanning) {
			const deltaX =
				e.clientX - lastPanPoint.x;
			const deltaY =
				e.clientY - lastPanPoint.y;

			updateCanvasTransform({
				x: canvasTransform.x + deltaX,
				y: canvasTransform.y + deltaY,
			});

			setLastPanPoint({
				x: e.clientX,
				y: e.clientY,
			});
		}
	};

	const handleMouseUp = () => {
		setIsPanning(false);
	};

	const handleWheel = (e: React.WheelEvent) => {
		// If a note box is editing, don't zoom - allow normal text scrolling
		if (editingBoxId) {
			return; // Let the text editor handle scrolling
		}

		// Always zoom with wheel, pan only when holding modifier keys
		if (
			e.ctrlKey ||
			e.metaKey ||
			e.shiftKey
		) {
			// Pan with modifier keys + wheel
			e.preventDefault();
			const deltaX = e.deltaX * 2;
			const deltaY = e.deltaY * 2;

			updateCanvasTransform({
				x: canvasTransform.x - deltaX,
				y: canvasTransform.y - deltaY,
			});
		} else {
			// Zoom without modifier keys
			e.preventDefault();
			const delta =
				e.deltaY > 0 ? 0.9 : 1.1;
			const newScale = Math.max(
				0.25,
				Math.min(
					5,
					canvasTransform.scale * delta
				)
			);

			const rect =
				canvasRef.current?.getBoundingClientRect();
			if (rect) {
				const mouseX =
					e.clientX - rect.left;
				const mouseY =
					e.clientY - rect.top;

				const scaleDiff =
					newScale -
					canvasTransform.scale;
				const newX =
					canvasTransform.x -
					(mouseX - canvasTransform.x) *
						(scaleDiff /
							canvasTransform.scale);
				const newY =
					canvasTransform.y -
					(mouseY - canvasTransform.y) *
						(scaleDiff /
							canvasTransform.scale);

				updateCanvasTransform({
					scale: newScale,
					x: newX,
					y: newY,
				});
			}
		}
	};

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey) {
				if (
					e.key === "z" &&
					!e.shiftKey
				) {
					e.preventDefault();
					// Undo is handled by toolbar
				} else if (
					e.key === "y" ||
					(e.key === "z" && e.shiftKey)
				) {
					e.preventDefault();
					// Redo is handled by toolbar
				}
			} else if (
				(e.key === "Delete" ||
					e.key === "Backspace") &&
				selectedBoxId &&
				e.target === document.body
			) {
				// Allow deletion via keyboard when a box is selected and no input is focused
				e.preventDefault();
				const noteBox = noteBoxes.find(
					(box) =>
						box.id === selectedBoxId
				);
				if (noteBox) {
					const first = noteBox
						.content[0] as unknown as {
						children?: Array<{
							text?: string;
						}>;
					};
					const firstText =
						first?.children?.[0]
							?.text;
					const hasContent =
						noteBox.content.length >
							1 ||
						(typeof firstText ===
							"string" &&
							firstText !==
								"Start typing...");
					if (hasContent) {
						if (
							confirm(
								"Delete this note box?"
							)
						) {
							useBoardStore
								.getState()
								.deleteNoteBox(
									selectedBoxId
								);
						}
					} else {
						useBoardStore
							.getState()
							.deleteNoteBox(
								selectedBoxId
							);
					}
				}
			}
		},
		[selectedBoxId, noteBoxes]
	);

	useEffect(() => {
		document.addEventListener(
			"keydown",
			handleKeyDown
		);
		return () =>
			document.removeEventListener(
				"keydown",
				handleKeyDown
			);
	}, [handleKeyDown]);

	const currentNote = getCurrentNote();

	// Join WS room when note changes
	useEffect(() => {
		if (workspace.active.noteId) {
			socketService.joinNote(
				workspace.active.noteId
			);
		}
	}, [workspace.active.noteId]);

	return (
		<div
			ref={canvasRef}
			className="flex-1 relative overflow-hidden cursor-default bg-background"
			onDoubleClick={handleDoubleClick}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onWheel={handleWheel}
			data-canvas="true"
			style={{
				cursor: isPanning
					? "grabbing"
					: "default",
			}}>
			<div
				className="absolute inset-0"
				style={{
					transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
					transformOrigin: "0 0",
				}}>
				{noteBoxes.map((noteBox) => (
					<NoteBox
						key={noteBox.id}
						noteBox={noteBox}
						isSelected={
							selectedBoxId ===
							noteBox.id
						}
						onSelect={() =>
							selectNoteBox(
								noteBox.id
							)
						}
						onFormatChange={
							setToolbarCallbacks
						}
					/>
				))}
			</div>

			{/* Zoom percentage display */}
			<div className="absolute top-4 right-4 pointer-events-none">
				<div className="bg-background/80 backdrop-blur-sm border border-border rounded-md px-2 py-1">
					<span className="text-xs text-muted-foreground font-mono">
						{Math.round(
							canvasTransform.scale *
								100
						)}
						%
					</span>
				</div>
			</div>

			{/* Instructions overlay */}
			{noteBoxes.length === 0 && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="text-center text-muted-foreground">
						<h2 className="text-2xl font-semibold mb-2">
							{currentNote
								? `Note: ${currentNote.title}`
								: "Welcome to Whiteboard Notes"}
						</h2>
						<p className="text-lg">
							Double-click anywhere
							to add a note box
						</p>
						<p className="text-sm mt-2">
							Scroll to zoom, drag
							to pan around
						</p>
						{!currentNote && (
							<p className="text-sm mt-4 text-primary">
								Create a
								collection and
								note from the left
								sidebar to get
								started
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
