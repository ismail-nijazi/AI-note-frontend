import { create } from "zustand";
import { produce } from "immer";
import { apiService } from "@/services/api";
import { Descendant } from "slate";
import {
	socketService,
	type InboundMessage,
} from "@/services/socket";

export interface Box {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	content: Descendant[];
}

export interface Note {
	id: string;
	title: string;
	boxes: Box[];
	createdAt: number;
	updatedAt: number;
	zoom: number;
	pan: { x: number; y: number };
	version: number;
}

export interface Collection {
	id: string;
	title: string;
	noteOrder: string[];
	notes: Record<string, Note>;
}

export interface Workspace {
	collectionOrder: string[];
	collections: Record<string, Collection>;
	active: {
		collectionId: string | null;
		noteId: string | null;
	};
}

interface WorkspaceState {
	workspace: Workspace;
	leftSidebarOpen: boolean;
	leftSidebarWidth: number;
	searchQuery: string;
}

interface WorkspaceActions {
	// Sidebar management
	toggleLeftSidebar: () => void;
	setLeftSidebarWidth: (width: number) => void;
	setSearchQuery: (query: string) => void;

	// Collection management
	createCollection: (
		title: string
	) => Promise<string>;
	updateCollection: (
		id: string,
		updates: Partial<
			Omit<Collection, "id" | "notes">
		>
	) => Promise<void>;
	deleteCollection: (
		id: string
	) => Promise<void>;
	reorderCollections: (
		newOrder: string[]
	) => void;

	// Note management
	createNote: (
		collectionId: string,
		title: string
	) => Promise<string>;
	updateNote: (
		collectionId: string,
		noteId: string,
		updates: Partial<Omit<Note, "id">>
	) => Promise<void>;
	deleteNote: (
		collectionId: string,
		noteId: string
	) => Promise<void>;
	reorderNotes: (
		collectionId: string,
		newOrder: string[]
	) => void;
	duplicateNote: (
		collectionId: string,
		noteId: string
	) => Promise<string>;

	// Active note management
	setActiveNote: (
		collectionId: string | null,
		noteId: string | null
	) => void;
	getCurrentNote: () => Note | null;

	// Persistence
	loadFromStorage: () => void;
	saveToStorage: () => void;
	exportWorkspace: () => string;
	importWorkspace: (data: string) => void;

	// Backend integration
	loadFromBackend: () => Promise<void>;
}

const initialWorkspace: Workspace = {
	collectionOrder: [],
	collections: {},
	active: {
		collectionId: null,
		noteId: null,
	},
};

const initialState: WorkspaceState = {
	workspace: initialWorkspace,
	leftSidebarOpen: true,
	leftSidebarWidth: 280,
	searchQuery: "",
};

export const useWorkspaceStore = create<
	WorkspaceState & WorkspaceActions
>((set, get) => ({
	...initialState,

	toggleLeftSidebar: () => {
		set(
			produce((state: WorkspaceState) => {
				state.leftSidebarOpen =
					!state.leftSidebarOpen;
			})
		);
		get().saveToStorage();
	},

	setLeftSidebarWidth: (width: number) => {
		const clampedWidth = Math.max(
			220,
			Math.min(380, width)
		);
		set(
			produce((state: WorkspaceState) => {
				state.leftSidebarWidth =
					clampedWidth;
			})
		);
		get().saveToStorage();
	},

	setSearchQuery: (query: string) => {
		set({ searchQuery: query });
	},

	createCollection: async (title: string) => {
		try {
			const response =
				await apiService.createCollection(
					{
						name: title,
						description: "",
						color: "#3B82F6",
					}
				);

			const createdCollection =
				await response.json();
			const id = createdCollection.id;
			set(
				produce(
					(state: WorkspaceState) => {
						state.workspace.collections[
							id
						] = {
							id,
							title,
							noteOrder: [],
							notes: {},
						};
						state.workspace.collectionOrder.push(
							id
						);
					}
				)
			);
			get().saveToStorage();
			return id;
		} catch (error) {
			console.error(
				"Failed to create collection:",
				error
			);
			throw error;
		}
	},

	updateCollection: async (
		id: string,
		updates: Partial<
			Omit<Collection, "id" | "notes">
		>
	) => {
		try {
			await apiService.updateCollection(
				id,
				{
					name: updates.title,
				}
			);

			set(
				produce(
					(state: WorkspaceState) => {
						const collection =
							state.workspace
								.collections[id];
						if (collection) {
							Object.assign(
								collection,
								updates
							);
						}
					}
				)
			);
			get().saveToStorage();
		} catch (error) {
			console.error(
				"Failed to update collection:",
				error
			);
			throw error;
		}
	},

	deleteCollection: async (id: string) => {
		try {
			await apiService.deleteCollection(id);

			set(
				produce(
					(state: WorkspaceState) => {
						delete state.workspace
							.collections[id];
						state.workspace.collectionOrder =
							state.workspace.collectionOrder.filter(
								(cId) =>
									cId !== id
							);

						// Clear active if this collection was active
						if (
							state.workspace.active
								.collectionId ===
							id
						) {
							state.workspace.active.collectionId =
								null;
							state.workspace.active.noteId =
								null;
						}
					}
				)
			);
			get().saveToStorage();
		} catch (error) {
			console.error(
				"Failed to delete collection:",
				error
			);
			throw error;
		}
	},

	reorderCollections: (newOrder: string[]) => {
		set(
			produce((state: WorkspaceState) => {
				state.workspace.collectionOrder =
					newOrder;
			})
		);
		get().saveToStorage();
	},

	createNote: async (
		collectionId: string,
		title: string
	) => {
		try {
			const response =
				await apiService.createNote({
					title,
					content: [],
					collectionId,
				});

			const createdNote =
				await response.json();
			const id = createdNote.id;
			const now = Date.now();
			set(
				produce(
					(state: WorkspaceState) => {
						const collection =
							state.workspace
								.collections[
								collectionId
							];
						if (collection) {
							collection.notes[id] =
								{
									id,
									title,
									boxes: [],
									createdAt:
										now,
									updatedAt:
										now,
									zoom: 1,
									pan: {
										x: 0,
										y: 0,
									},
									version:
										createdNote.version ||
										1,
								};
							collection.noteOrder.push(
								id
							);
						}
					}
				)
			);
			get().saveToStorage();
			return id;
		} catch (error) {
			console.error(
				"Failed to create note:",
				error
			);
			throw error;
		}
	},

	updateNote: async (
		collectionId: string,
		noteId: string,
		updates: Partial<Omit<Note, "id">>
	) => {
		try {
			set(
				produce(
					(state: WorkspaceState) => {
						const note =
							state.workspace
								.collections[
								collectionId
							]?.notes[noteId];
						if (note) {
							Object.assign(note, {
								...updates,
								updatedAt:
									Date.now(),
							});
						}
					}
				)
			);
			get().saveToStorage();
		} catch (error) {
			console.error(
				"Failed to update note:",
				error
			);
			throw error;
		}
	},

	deleteNote: async (
		collectionId: string,
		noteId: string
	) => {
		try {
			await apiService.deleteNote(noteId);

			set(
				produce(
					(state: WorkspaceState) => {
						const collection =
							state.workspace
								.collections[
								collectionId
							];
						if (collection) {
							delete collection
								.notes[noteId];
							collection.noteOrder =
								collection.noteOrder.filter(
									(nId) =>
										nId !==
										noteId
								);

							// Clear active if this note was active
							if (
								state.workspace
									.active
									.noteId ===
								noteId
							) {
								state.workspace.active.noteId =
									null;
							}
						}
					}
				)
			);
			get().saveToStorage();
		} catch (error) {
			console.error(
				"Failed to delete note:",
				error
			);
			throw error;
		}
	},

	reorderNotes: (
		collectionId: string,
		newOrder: string[]
	) => {
		set(
			produce((state: WorkspaceState) => {
				const collection =
					state.workspace.collections[
						collectionId
					];
				if (collection) {
					collection.noteOrder =
						newOrder;
				}
			})
		);
		get().saveToStorage();
	},

	duplicateNote: async (
		collectionId: string,
		noteId: string
	) => {
		try {
			const response =
				await apiService.duplicateNote(
					noteId,
					{
						title: `${
							get().workspace
								.collections[
								collectionId
							]?.notes[noteId]
								?.title
						} (Copy)`,
						collectionId,
					}
				);

			const duplicated =
				await response.json();
			const newId = duplicated.id;
			set(
				produce(
					(state: WorkspaceState) => {
						const collection =
							state.workspace
								.collections[
								collectionId
							];
						if (collection) {
							const duplicatedNote: Note =
								{
									id: newId,
									title: duplicated.title,
									boxes:
										duplicated.content ||
										[],
									createdAt:
										Date.now(),
									updatedAt:
										Date.now(),
									zoom: 1,
									pan: {
										x: 0,
										y: 0,
									},
									version:
										duplicated.version ||
										1,
								};
							collection.notes[
								newId
							] = duplicatedNote;
							const originalIndex =
								collection.noteOrder.indexOf(
									noteId
								);
							collection.noteOrder.splice(
								originalIndex + 1,
								0,
								newId
							);
						}
					}
				)
			);
			get().saveToStorage();
			return newId;
		} catch (error) {
			console.error(
				"Failed to duplicate note:",
				error
			);
			throw error;
		}
	},

	setActiveNote: (
		collectionId: string | null,
		noteId: string | null
	) => {
		set(
			produce((state: WorkspaceState) => {
				state.workspace.active.collectionId =
					collectionId;
				state.workspace.active.noteId =
					noteId;
			})
		);
		get().saveToStorage();
	},

	getCurrentNote: () => {
		const { workspace } = get();
		const { collectionId, noteId } =
			workspace.active;
		if (!collectionId || !noteId) return null;
		return (
			workspace.collections[collectionId]
				?.notes[noteId] || null
		);
	},

	loadFromStorage: () => {
		try {
			const saved = localStorage.getItem(
				"whiteboard.workspace.v1"
			);
			if (saved) {
				const parsedState =
					JSON.parse(saved);
				set(
					produce(
						(
							state: WorkspaceState
						) => {
							// Restore workspace data but clear active note
							state.workspace.collections =
								parsedState.workspace.collections;
							state.workspace.collectionOrder =
								parsedState.workspace.collectionOrder;
							// Don't restore active note - let user choose
							state.workspace.active =
								{
									collectionId:
										null,
									noteId: null,
								};
						}
					)
				);
			}
		} catch (error) {
			console.error(
				"Failed to load workspace from storage:",
				error
			);
		}
	},

	saveToStorage: () => {
		try {
			const state = get();
			localStorage.setItem(
				"whiteboard.workspace.v1",
				JSON.stringify(state)
			);
		} catch (error) {
			console.error(
				"Failed to save workspace to storage:",
				error
			);
		}
	},

	exportWorkspace: () => {
		const { workspace } = get();
		return JSON.stringify(workspace, null, 2);
	},

	importWorkspace: (data: string) => {
		try {
			const importedWorkspace =
				JSON.parse(data);
			set(
				produce(
					(state: WorkspaceState) => {
						state.workspace =
							importedWorkspace;
					}
				)
			);
			get().saveToStorage();
		} catch (error) {
			console.error(
				"Failed to import workspace:",
				error
			);
			throw new Error(
				"Invalid workspace data"
			);
		}
	},

	loadFromBackend: async () => {
		try {
			// Load collections from backend
			const collectionsResponse =
				await apiService.getCollections();
			const collectionsJson =
				await collectionsResponse.json();
			const collections =
				collectionsJson.data ||
				collectionsJson ||
				[];

			// Load notes for each collection
			const collectionsWithNotes: Record<
				string,
				Collection
			> = {};

			for (const collection of collections) {
				const notesResponse =
					await apiService.getNotes({
						collectionId:
							collection.id,
						sortBy: "createdAt",
						sortOrder: "asc",
					});
				const notesJson =
					await notesResponse.json();
				const notes =
					notesJson.data ||
					notesJson ||
					[];

				const notesMap: Record<
					string,
					Note
				> = {};
				type BackendNote = {
					id: string;
					title: string;
					content?: Box[];
					createdAt: string;
					updatedAt: string;
					version?: number;
				};
				notes.forEach(
					(note: BackendNote) => {
						notesMap[note.id] = {
							id: note.id,
							title: note.title,
							boxes:
								note.content ||
								[],
							createdAt: new Date(
								note.createdAt
							).getTime(),
							updatedAt: new Date(
								note.updatedAt
							).getTime(),
							zoom: 1,
							pan: { x: 0, y: 0 },
							version:
								note.version || 1,
						};
					}
				);

				collectionsWithNotes[
					collection.id
				] = {
					id: collection.id,
					title: collection.name,
					noteOrder: notes.map(
						(note: Note) => note.id
					),
					notes: notesMap,
				};
			}

			set(
				produce(
					(state: WorkspaceState) => {
						state.workspace.collections =
							collectionsWithNotes;
						state.workspace.collectionOrder =
							collections.map(
								(c: Collection) =>
									c.id
							);
					}
				)
			);

			get().saveToStorage();
		} catch (error) {
			console.error(
				"Failed to load from backend:",
				error
			);
			// Fallback to local storage
			get().loadFromStorage();
		}
	},
}));

// Subscribe once to incoming socket messages to merge updates
socketService.on((msg: InboundMessage) => {
	if (msg.type === "note:updated") {
		const { noteId, content, version } = msg;
		const state =
			useWorkspaceStore.getState();
		const { collectionId } =
			state.workspace.active;
		if (!collectionId) return;
		useWorkspaceStore.setState((prev) => {
			const next = JSON.parse(
				JSON.stringify(prev)
			);
			const n =
				next.workspace.collections[
					collectionId
				]?.notes[noteId];
			if (n) {
				n.boxes = content || n.boxes;
				n.version = version || n.version;
				n.updatedAt = Date.now();
			}
			return next;
		});
	}
});
