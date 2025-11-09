import { create } from "zustand";
import { produce } from "immer";
import { Descendant } from "slate";
import { apiService } from "@/services/api";
import { socketService } from "@/services/socket";
import { useWorkspaceStore } from "@/state/useWorkspaceStore";
import type { Workspace } from "@/state/useWorkspaceStore";

export interface NoteBox {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	content: Descendant[];
}

export interface BoardState {
	noteBoxes: NoteBox[];
	selectedBoxId: string | null;
	editingBoxId: string | null;
	canvasTransform: {
		x: number;
		y: number;
		scale: number;
	};
	history: BoardState[];
	historyIndex: number;
	maxHistory: number;
}

interface BoardActions {
	addNoteBox: (x: number, y: number) => void;
	updateNoteBox: (
		id: string,
		updates: Partial<NoteBox>
	) => void;
	deleteNoteBox: (id: string) => void;
	selectNoteBox: (id: string | null) => void;
	setEditingBox: (id: string | null) => void;
	insertContentToBox: (
		id: string,
		text: string
	) => void;
	replaceBoxContent: (
		id: string,
		text: string
	) => void;
	appendTextToBox: (
		id: string,
		text: string
	) => void;
	bringToFront: (id: string) => void;
	sendToBack: (id: string) => void;
	duplicateNoteBox: (id: string) => void;
	updateCanvasTransform: (
		transform: Partial<
			BoardState["canvasTransform"]
		>
	) => void;
	undo: () => void;
	redo: () => void;
	saveToHistory: () => void;
	loadFromStorage: () => void;
	saveToStorage: () => void;
	loadNote: (
		boxes: NoteBox[],
		transform: BoardState["canvasTransform"]
	) => void;
	clearBoard: () => void;

	// Backend sync
	syncNoteToBackend: (
		noteId: string
	) => Promise<void>;
}

export const DEFAULT_NOTEBOX_CONTENT_HEIGHT = 40;
export const NOTEBOX_HEADER_HEIGHT = 32;
export const DEFAULT_NOTEBOX_HEIGHT =
	DEFAULT_NOTEBOX_CONTENT_HEIGHT +
	NOTEBOX_HEADER_HEIGHT;

const defaultContent: Descendant[] = [
	{
		type: "paragraph",
		children: [{ text: "Start typing..." }],
	},
];

const initialState: BoardState = {
	noteBoxes: [],
	selectedBoxId: null,
	editingBoxId: null,
	canvasTransform: { x: 0, y: 0, scale: 1 },
	history: [],
	historyIndex: -1,
	maxHistory: 50,
};

export const useBoardStore = create<
	BoardState & BoardActions
>((set, get) => ({
	...initialState,

	addNoteBox: (x: number, y: number) => {
		const newBox: NoteBox = {
			id: Date.now().toString(),
			x,
			y,
			width: 300,
			height: DEFAULT_NOTEBOX_HEIGHT,
			zIndex: Date.now(),
			content: [...defaultContent],
		};

		set(
			produce((state: BoardState) => {
				state.noteBoxes.push(newBox);
				state.selectedBoxId = newBox.id;
			})
		);

		get().saveToHistory();
		get().saveToStorage();
	},

	updateNoteBox: (
		id: string,
		updates: Partial<NoteBox>
	) => {
		set(
			produce((state: BoardState) => {
				const box = state.noteBoxes.find(
					(box) => box.id === id
				);
				if (box) {
					Object.assign(box, updates);
				}
			})
		);

		get().saveToStorage();
	},

	deleteNoteBox: (id: string) => {
		set(
			produce((state: BoardState) => {
				state.noteBoxes =
					state.noteBoxes.filter(
						(box) => box.id !== id
					);
				if (state.selectedBoxId === id) {
					state.selectedBoxId = null;
				}
			})
		);

		get().saveToHistory();
		get().saveToStorage();
	},

	selectNoteBox: (id: string | null) => {
		set({ selectedBoxId: id });
	},

	setEditingBox: (id: string | null) => {
		set({ editingBoxId: id });
	},

	// Insert content into a note box (appends to end)
	insertContentToBox: (
		id: string,
		text: string
	) => {
		const box = get().noteBoxes.find(
			(b) => b.id === id
		);
		if (!box) return;

		// Convert text to Slate format (simple paragraph)
		const newParagraph: Descendant = {
			type: "paragraph",
			children: [{ text }],
		};

		set(
			produce((state: BoardState) => {
				const box = state.noteBoxes.find(
					(b) => b.id === id
				);
				if (box) {
					// Append new paragraph to existing content
					box.content = [
						...box.content,
						newParagraph,
					];
				}
			})
		);

		get().saveToStorage();
		get().saveToHistory();
	},

	// Replace content in a note box
	replaceBoxContent: (
		id: string,
		text: string
	) => {
		// Convert text to Slate format
		const newContent: Descendant[] = [
			{
				type: "paragraph",
				children: [{ text }],
			},
		];

		get().updateNoteBox(id, {
			content: newContent,
		});
		get().saveToHistory();
	},

	// Append text to existing content in a box (at cursor or end)
	appendTextToBox: (
		id: string,
		text: string
	) => {
		const box = get().noteBoxes.find(
			(b) => b.id === id
		);
		if (!box || box.content.length === 0) {
			get().replaceBoxContent(id, text);
			return;
		}

		// Get the last element and append text to it
		set(
			produce((state: BoardState) => {
				const box = state.noteBoxes.find(
					(b) => b.id === id
				);
				if (
					box &&
					box.content.length > 0
				) {
					const lastElement =
						box.content[
							box.content.length - 1
						];
					if (
						lastElement &&
						"children" in lastElement
					) {
						const lastTextNode =
							lastElement.children[
								lastElement
									.children
									.length - 1
							];
						if (
							lastTextNode &&
							"text" in lastTextNode
						) {
							// Append to last text node
							lastTextNode.text =
								lastTextNode.text +
								"\n" +
								text;
						} else {
							// Add new text node
							const textNode: {
								text: string;
							} = { text };
							(
								lastElement.children as Array<{
									text: string;
								}>
							).push(textNode);
						}
					}
				}
			})
		);

		get().saveToStorage();
		get().saveToHistory();
	},

	bringToFront: (id: string) => {
		const maxZ = Math.max(
			...get().noteBoxes.map(
				(box) => box.zIndex
			)
		);
		get().updateNoteBox(id, {
			zIndex: maxZ + 1,
		});
		get().saveToHistory();
	},

	// Subscribe to WS updates to merge remote changes
	// Call once when app initializes

	sendToBack: (id: string) => {
		const minZ = Math.min(
			...get().noteBoxes.map(
				(box) => box.zIndex
			)
		);
		get().updateNoteBox(id, {
			zIndex: minZ - 1,
		});
		get().saveToHistory();
	},

	duplicateNoteBox: (id: string) => {
		const box = get().noteBoxes.find(
			(box) => box.id === id
		);
		if (box) {
			const newBox: NoteBox = {
				...box,
				id: Date.now().toString(),
				x: box.x + 20,
				y: box.y + 20,
				zIndex: Date.now(),
				content: JSON.parse(
					JSON.stringify(box.content)
				),
			};

			set(
				produce((state: BoardState) => {
					state.noteBoxes.push(newBox);
					state.selectedBoxId =
						newBox.id;
				})
			);

			get().saveToHistory();
			get().saveToStorage();
		}
	},

	updateCanvasTransform: (
		transform: Partial<
			BoardState["canvasTransform"]
		>
	) => {
		set(
			produce((state: BoardState) => {
				Object.assign(
					state.canvasTransform,
					transform
				);
			})
		);
	},

	saveToHistory: () => {
		set(
			produce((state: BoardState) => {
				const currentState = {
					noteBoxes: JSON.parse(
						JSON.stringify(
							state.noteBoxes
						)
					),
					selectedBoxId:
						state.selectedBoxId,
					editingBoxId:
						state.editingBoxId,
					canvasTransform: {
						...state.canvasTransform,
					},
					history: [],
					historyIndex: -1,
					maxHistory: state.maxHistory,
				};

				// Remove any history after current index
				state.history =
					state.history.slice(
						0,
						state.historyIndex + 1
					);

				// Add current state to history
				state.history.push(currentState);

				// Limit history size
				if (
					state.history.length >
					state.maxHistory
				) {
					state.history =
						state.history.slice(
							-state.maxHistory
						);
				}

				state.historyIndex =
					state.history.length - 1;
			})
		);
	},

	undo: () => {
		const { history, historyIndex } = get();
		if (historyIndex > 0) {
			const previousState =
				history[historyIndex - 1];
			set(
				produce((state: BoardState) => {
					state.noteBoxes = JSON.parse(
						JSON.stringify(
							previousState.noteBoxes
						)
					);
					state.selectedBoxId =
						previousState.selectedBoxId;
					state.canvasTransform = {
						...previousState.canvasTransform,
					};
					state.historyIndex =
						historyIndex - 1;
				})
			);
			get().saveToStorage();
		}
	},

	redo: () => {
		const { history, historyIndex } = get();
		if (historyIndex < history.length - 1) {
			const nextState =
				history[historyIndex + 1];
			set(
				produce((state: BoardState) => {
					state.noteBoxes = JSON.parse(
						JSON.stringify(
							nextState.noteBoxes
						)
					);
					state.selectedBoxId =
						nextState.selectedBoxId;
					state.canvasTransform = {
						...nextState.canvasTransform,
					};
					state.historyIndex =
						historyIndex + 1;
				})
			);
			get().saveToStorage();
		}
	},

	loadFromStorage: () => {
		try {
			const saved = localStorage.getItem(
				"whiteboard-state"
			);
			if (saved) {
				const parsedState =
					JSON.parse(saved);
				set(
					produce(
						(state: BoardState) => {
							state.noteBoxes =
								parsedState.noteBoxes ||
								[];
							state.canvasTransform =
								parsedState.canvasTransform || {
									x: 0,
									y: 0,
									scale: 1,
								};
							state.selectedBoxId =
								null;
						}
					)
				);
			}
		} catch (error) {
			console.error(
				"Failed to load from storage:",
				error
			);
		}
	},

	saveToStorage: () => {
		try {
			const { noteBoxes, canvasTransform } =
				get();
			const stateToSave = {
				noteBoxes,
				canvasTransform,
			};
			localStorage.setItem(
				"whiteboard-state",
				JSON.stringify(stateToSave)
			);
		} catch (error) {
			console.error(
				"Failed to save to storage:",
				error
			);
		}
	},

	loadNote: (
		boxes: NoteBox[],
		transform: BoardState["canvasTransform"]
	) => {
		set(
			produce((state: BoardState) => {
				state.noteBoxes = [...boxes];
				state.canvasTransform = {
					...transform,
				};
				state.selectedBoxId = null;
				state.editingBoxId = null;
			})
		);
	},

	clearBoard: () => {
		set(
			produce((state: BoardState) => {
				state.noteBoxes = [];
				state.selectedBoxId = null;
				state.editingBoxId = null;
			})
		);
	},

	syncNoteToBackend: async (noteId: string) => {
		try {
			// Skip syncing when offline
			if (
				typeof navigator !==
					"undefined" &&
				navigator &&
				navigator.onLine === false
			) {
				return;
			}
			const { noteBoxes } = get();
			const ws =
				useWorkspaceStore.getState();
			const { collectionId } =
				ws.workspace.active;
			const note = collectionId
				? ws.workspace.collections[
						collectionId
				  ]?.notes[noteId]
				: undefined;

			const currentVersion =
				note?.version || 1;

			const attemptUpdate = async (
				version: number
			) => {
				// Prefer WS update
				socketService.connect();
				socketService.joinNote(noteId);
				socketService.send({
					type: "note:update",
					noteId,
					content: noteBoxes,
					version,
				});

				// Fallback to HTTP if no ack within 500ms
				setTimeout(async () => {
					try {
						const res =
							await apiService.updateNote(
								noteId,
								{
									content:
										noteBoxes,
									version,
								}
							);
						const updated =
							await res.json();
						useWorkspaceStore.setState(
							produce(
								(state: {
									workspace: Workspace;
								}) => {
									if (
										collectionId
									) {
										const n =
											state
												.workspace
												.collections[
												collectionId
											]
												?.notes[
												noteId
											];
										if (n)
											n.version =
												updated.version ||
												n.version +
													1;
									}
								}
							)
						);
					} catch (error) {
						console.error(
							"Failed to update note via HTTP fallback:",
							error
						);
					}
				}, 500);
			};

			try {
				await attemptUpdate(
					currentVersion
				);
			} catch (e: unknown) {
				// If 409, fetch current version and retry once
				if (
					e instanceof Error &&
					/status:\s*409/.test(
						e.message
					)
				) {
					const latestRes =
						await apiService.getNote(
							noteId
						);
					const latest =
						await latestRes.json();
					useWorkspaceStore.setState(
						produce(
							(state: {
								workspace: Workspace;
							}) => {
								if (
									collectionId
								) {
									const n =
										state
											.workspace
											.collections[
											collectionId
										]?.notes[
											noteId
										];
									if (n)
										n.version =
											latest.version ||
											n.version;
								}
							}
						)
					);
					await attemptUpdate(
						latest.version ||
							currentVersion
					);
				} else {
					throw e;
				}
			}
		} catch (error) {
			// Avoid noisy errors when offline or network blips
			if (
				typeof navigator !==
					"undefined" &&
				navigator &&
				navigator.onLine === false
			) {
				return;
			}
			console.log("error", error);
			console.error(
				"Failed to sync note to backend:",
				error
			);
			// Don't throw error to avoid breaking the UI
		}
	},
}));

socketService.on((msg) => {
	if (msg.type !== "note:updated") {
		return;
	}

	const { noteId, content } = msg;
	const workspaceState =
		useWorkspaceStore.getState();
	if (
		workspaceState.workspace.active.noteId !==
		noteId
	) {
		return;
	}

	const boxesSource = Array.isArray(
		(content as any)?.boxes
	)
		? (content as any).boxes
		: content;

	if (!Array.isArray(boxesSource)) {
		return;
	}

	const clonedBoxes = JSON.parse(
		JSON.stringify(boxesSource)
	);
	const validIds = new Set(
		clonedBoxes
			.map(
				(box: { id?: string }) => box?.id
			)
			.filter(
				(
					id: string | undefined
				): id is string =>
					typeof id === "string"
			)
	);

	useBoardStore.setState(
		produce((state: BoardState) => {
			state.noteBoxes = clonedBoxes;
			if (
				state.selectedBoxId &&
				!validIds.has(state.selectedBoxId)
			) {
				state.selectedBoxId = null;
			}
			if (
				state.editingBoxId &&
				!validIds.has(state.editingBoxId)
			) {
				state.editingBoxId = null;
			}
		})
	);

	useBoardStore.getState().saveToStorage();
});
