import React, {
	useCallback,
	useMemo,
	useRef,
	useEffect,
	useState,
} from "react";
import { Rnd } from "react-rnd";
import {
	Descendant,
	Editor,
	Transforms,
	Element as SlateElement,
} from "slate";
import {
	useBoardStore,
	NoteBox as NoteBoxType,
} from "@/state/useBoardStore";
import {
	createNoteBoxEditor,
	cloneContent,
	ensureLinkForSelection,
	isUrl,
	normalizeUrl,
	unwrapLink,
} from "./editorUtils";
import type {
	CustomElement,
	CustomText,
	ListItemElement,
	NoteEditor,
} from "./types";
import { NoteBoxEditor } from "@/components/note-box/NoteBoxEditor";

interface NoteBoxProps {
	noteBox: NoteBoxType;
	isSelected: boolean;
	onSelect: () => void;
	onFormatChange: (
		callbacks: FormatCallbacks
	) => void;
}

type FormatCallbacks = {
	onBold: () => void;
	onItalic: () => void;
	onUnderline: () => void;
	onStrikethrough: () => void;
	onFontSize: (size: string) => void;
	onParagraph: () => void;
	onBulletList: () => void;
	onNumberList: () => void;
	onQuote: () => void;
	onCode: () => void;
	onCodeBlock: () => void;
	onLink: () => void;
	onUnlink: () => void;
	onImage: () => void;
	getCurrentFontSize: () => string;
	isFormatActive: (format: string) => boolean;
};

const extractPlainText = (
	nodes: Descendant[]
): string => {
	const parts: string[] = [];

	const visit = (node: Descendant) => {
		if (SlateElement.isElement(node)) {
			node.children.forEach(visit);
		} else {
			parts.push(node.text ?? "");
		}
	};

	nodes.forEach(visit);
	return parts.join("").trim();
};

const PLACEHOLDER_TEXT = "Start typing...";

const hasMeaningfulContent = (
	content: Descendant[]
): boolean => {
	if (!content.length) {
		return false;
	}
	const text = extractPlainText(content);
	if (!text.length) {
		return false;
	}
	return text !== PLACEHOLDER_TEXT;
};

export const NoteBox: React.FC<NoteBoxProps> = ({
	noteBox,
	isSelected,
	onSelect,
	onFormatChange,
}) => {
	const {
		updateNoteBox,
		bringToFront,
		deleteNoteBox,
		duplicateNoteBox,
		sendToBack,
		saveToHistory,
		canvasTransform,
		editingBoxId,
		setEditingBox,
	} = useBoardStore();
	const editorRef =
		useRef<HTMLDivElement | null>(null);
	const containerRef =
		useRef<HTMLDivElement | null>(null);

	// Use global editing state
	const isEditing = editingBoxId === noteBox.id;

	const editor = useMemo<NoteEditor>(
		() => createNoteBoxEditor(),
		[]
	);
	const [value, setValue] = useState<
		Descendant[]
	>(() => cloneContent(noteBox.content));

	const isMarkActive = useCallback(
		(format: string) => {
			const marks = Editor.marks(editor);
			return marks
				? marks[
						format as keyof CustomText
				  ] === true
				: false;
		},
		[editor]
	);

	const isBlockActive = useCallback(
		(format: string) => {
			const { selection } = editor;
			if (!selection) return false;

			const [match] = Array.from(
				Editor.nodes(editor, {
					at: Editor.unhangRange(
						editor,
						selection
					),
					match: (n) =>
						!Editor.isEditor(n) &&
						SlateElement.isElement(
							n
						) &&
						(n as CustomElement)
							.type === format,
				})
			);

			return !!match;
		},
		[editor]
	);

	const toggleMark = useCallback(
		(format: string) => {
			const isActive = isMarkActive(format);
			if (isActive) {
				Editor.removeMark(editor, format);
			} else {
				Editor.addMark(
					editor,
					format,
					true
				);
			}
		},
		[editor, isMarkActive]
	);

	const toggleBlock = useCallback(
		(format: CustomElement["type"]) => {
			const isActive =
				isBlockActive(format);
			const isList =
				format === "numbered-list" ||
				format === "bulleted-list";

			Transforms.unwrapNodes(editor, {
				match: (n) =>
					!Editor.isEditor(n) &&
					SlateElement.isElement(n) &&
					((n as CustomElement).type ===
						"numbered-list" ||
						(n as CustomElement)
							.type ===
							"bulleted-list"),
				split: true,
			});

			const nextType: CustomElement["type"] =
				isActive
					? "paragraph"
					: isList
					? "list-item"
					: format;

			Transforms.setNodes<CustomElement>(
				editor,
				{
					type: nextType,
				}
			);

			if (!isActive && isList) {
				const listBlock: CustomElement =
					format === "bulleted-list"
						? {
								type: "bulleted-list",
								children:
									[] as ListItemElement[],
						  }
						: {
								type: "numbered-list",
								children:
									[] as ListItemElement[],
						  };
				Transforms.wrapNodes(
					editor,
					listBlock
				);
			}
		},
		[editor, isBlockActive]
	);

	const insertLink = useCallback(() => {
		const input = window.prompt(
			"Enter the URL:"
		);
		if (!input) return;

		const normalized = normalizeUrl(input);

		if (!isUrl(normalized)) {
			window.alert(
				"Please enter a valid URL."
			);
			return;
		}

		ensureLinkForSelection(
			editor,
			normalized
		);
	}, [editor]);

	const removeLink = useCallback(() => {
		unwrapLink(editor);
	}, [editor]);

	const insertImage = useCallback(() => {
		const input =
			document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = (e) => {
			const file = (
				e.target as HTMLInputElement
			).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = () => {
					const url =
						reader.result as string;
					const imageElement: CustomElement =
						{
							type: "image",
							url,
							children: [
								{ text: "" },
							],
						};
					Transforms.insertNodes(
						editor,
						imageElement
					);
				};
				reader.readAsDataURL(file);
			}
		};
		input.click();
	}, [editor]);

	const formatCallbacks =
		useMemo<FormatCallbacks>(
			() => ({
				onBold: () => toggleMark("bold"),
				onItalic: () =>
					toggleMark("italic"),
				onUnderline: () =>
					toggleMark("underline"),
				onStrikethrough: () =>
					toggleMark("strikethrough"),
				onFontSize: (size: string) => {
					Editor.removeMark(
						editor,
						"fontSize"
					);
					const fontSize = parseInt(
						size,
						10
					);
					if (
						!Number.isNaN(fontSize) &&
						fontSize !== 14
					) {
						Editor.addMark(
							editor,
							"fontSize",
							fontSize
						);
					}
				},
				onParagraph: () =>
					toggleBlock("paragraph"),
				onBulletList: () =>
					toggleBlock("bulleted-list"),
				onNumberList: () =>
					toggleBlock("numbered-list"),
				onQuote: () =>
					toggleBlock("block-quote"),
				onCode: () => toggleMark("code"),
				onCodeBlock: () =>
					toggleBlock("code-block"),
				onLink: insertLink,
				onUnlink: removeLink,
				onImage: insertImage,
				getCurrentFontSize: () => {
					const marks =
						Editor.marks(editor);
					if (
						!marks ||
						!marks.fontSize
					) {
						return "14";
					}
					return marks.fontSize.toString();
				},
				isFormatActive: (
					format: string
				) => {
					if (
						[
							"bold",
							"italic",
							"underline",
							"strikethrough",
							"code",
						].includes(format)
					) {
						return isMarkActive(
							format
						);
					}
					return isBlockActive(format);
				},
			}),
			[
				editor,
				insertImage,
				insertLink,
				isBlockActive,
				isMarkActive,
				removeLink,
				toggleBlock,
				toggleMark,
			]
		);

	const adjustHeightToContent =
		useCallback(() => {
			const editorEl = editorRef.current;
			const containerEl =
				containerRef.current;
			if (!editorEl || !containerEl) return;

			const style =
				window.getComputedStyle(
					containerEl
				);
			const paddingTop =
				parseFloat(style.paddingTop) || 0;
			const paddingBottom =
				parseFloat(style.paddingBottom) ||
				0;

			const editorHeight =
				editorEl.scrollHeight;
			const desiredHeight = Math.ceil(
				editorHeight +
					paddingTop +
					paddingBottom
			);
			const minHeight = 120;
			const nextHeight = Math.max(
				minHeight,
				desiredHeight
			);

			if (
				Math.abs(
					nextHeight - noteBox.height
				) > 1
			) {
				updateNoteBox(noteBox.id, {
					height: nextHeight,
				});
			}
		}, [
			noteBox.height,
			noteBox.id,
			updateNoteBox,
		]);

	useEffect(() => {
		const raf = requestAnimationFrame(
			adjustHeightToContent
		);
		return () => cancelAnimationFrame(raf);
	}, [
		value,
		isEditing,
		noteBox.width,
		noteBox.content,
		adjustHeightToContent,
	]);

	const editorSelection = editor.selection;

	useEffect(() => {
		if (isSelected) {
			onFormatChange(formatCallbacks);
		}
	}, [
		isSelected,
		formatCallbacks,
		onFormatChange,
		editorSelection,
	]);

	const handleChange = useCallback(
		(newValue: Descendant[]) => {
			const clonedValue =
				cloneContent(newValue);
			setValue(clonedValue);
			updateNoteBox(noteBox.id, {
				content: clonedValue,
			});
			requestAnimationFrame(
				adjustHeightToContent
			);
		},
		[
			noteBox.id,
			updateNoteBox,
			adjustHeightToContent,
		]
	);

	const contentsAreEqual = useCallback(
		(a: Descendant[], b: Descendant[]) => {
			if (a === b) return true;
			if (!a || !b) return false;
			return (
				JSON.stringify(a) ===
				JSON.stringify(b)
			);
		},
		[]
	);

	useEffect(() => {
		if (isEditing) {
			return;
		}

		if (
			!contentsAreEqual(
				value,
				noteBox.content
			)
		) {
			const cloned = cloneContent(
				noteBox.content
			);
			setValue(cloned);
			if (
				!contentsAreEqual(
					editor.children as Descendant[],
					cloned
				)
			) {
				editor.children = cloned;
				editor.onChange();
			}
		}
	}, [
		noteBox.content,
		isEditing,
		contentsAreEqual,
		value,
		editor,
	]);

	useEffect(() => {
		if (!isEditing) {
			return;
		}

		const cloned = cloneContent(
			noteBox.content
		);

		if (!contentsAreEqual(value, cloned)) {
			setValue(cloned);
		}

		if (
			!contentsAreEqual(
				editor.children as Descendant[],
				cloned
			)
		) {
			editor.children = cloned;
			editor.onChange();
		}
	}, [
		isEditing,
		noteBox.content,
		editor,
		contentsAreEqual,
		value,
	]);

	useEffect(() => {
		setValue(cloneContent(noteBox.content));
	}, [noteBox.id, noteBox.content]);

	const handleKeyDown = (
		event: React.KeyboardEvent
	) => {
		if (event.key === "Escape") {
			setEditingBox(null);
			if (editorRef.current) {
				editorRef.current.blur();
			}
		} else if (
			(event.key === "Delete" ||
				event.key === "Backspace") &&
			!isEditing
		) {
			// Delete the note box when Delete/Backspace is pressed and not editing text
			event.preventDefault();
			const hasContent =
				hasMeaningfulContent(
					noteBox.content
				);
			if (hasContent) {
				if (
					confirm(
						"Delete this note box?"
					)
				) {
					deleteNoteBox(noteBox.id);
				}
			} else {
				deleteNoteBox(noteBox.id);
			}
		}
	};

	const handleContextMenu = (
		e: React.MouseEvent
	) => {
		e.preventDefault();

		// Remove any existing context menus
		const existingMenus =
			document.querySelectorAll(
				".context-menu-noteBox"
			);
		existingMenus.forEach((menu) =>
			menu.remove()
		);

		const menu =
			document.createElement("div");
		menu.className =
			"context-menu-noteBox fixed bg-card border border-border rounded shadow-lg p-1 z-50";
		menu.style.left = `${e.clientX}px`;
		menu.style.top = `${e.clientY}px`;

		const actions: Array<{
			label: string;
			action: () => void;
		}> = [
			{
				label: "Duplicate",
				action: () =>
					duplicateNoteBox(noteBox.id),
			},
			{
				label: "Bring to Front",
				action: () =>
					bringToFront(noteBox.id),
			},
			{
				label: "Send to Back",
				action: () =>
					sendToBack(noteBox.id),
			},
			{
				label: "Delete",
				action: () => {
					const hasContent =
						hasMeaningfulContent(
							noteBox.content
						);
					if (hasContent) {
						if (
							confirm(
								"Delete this note box?"
							)
						) {
							deleteNoteBox(
								noteBox.id
							);
						}
					} else {
						deleteNoteBox(noteBox.id);
					}
				},
			},
		];

		actions.forEach((action) => {
			const button =
				document.createElement("button");
			button.className =
				"block w-full text-left px-2 py-1 hover:bg-accent rounded text-sm";
			button.textContent = action.label;
			button.onclick = () => {
				action.action();
				document.body.removeChild(menu);
			};
			menu.appendChild(button);
		});

		document.body.appendChild(menu);

		const cleanup = () => {
			if (document.body.contains(menu)) {
				document.body.removeChild(menu);
			}
			document.removeEventListener(
				"click",
				cleanup
			);
		};

		setTimeout(
			() =>
				document.addEventListener(
					"click",
					cleanup
				),
			0
		);
	};

	return (
		<Rnd
			size={{
				width: noteBox.width,
				height: noteBox.height,
			}}
			position={{
				x: noteBox.x,
				y: noteBox.y,
			}}
			enableResizing={{
				top: !isEditing,
				right: !isEditing,
				bottom: !isEditing,
				left: !isEditing,
				topRight: !isEditing,
				bottomRight: !isEditing,
				bottomLeft: !isEditing,
				topLeft: !isEditing,
			}}
			onDrag={(e, d) => {
				// No need to adjust coordinates - react-rnd already handles the scaling
				updateNoteBox(noteBox.id, {
					x: d.x,
					y: d.y,
				});
			}}
			onDragStop={(e, d) => {
				updateNoteBox(noteBox.id, {
					x: d.x,
					y: d.y,
				});
				saveToHistory();
			}}
			onResize={(
				e,
				direction,
				ref,
				delta,
				position
			) => {
				updateNoteBox(noteBox.id, {
					width: parseInt(
						ref.style.width
					),
					height: parseInt(
						ref.style.height
					),
					x: position.x,
					y: position.y,
				});
			}}
			onResizeStop={(
				e,
				direction,
				ref,
				delta,
				position
			) => {
				updateNoteBox(noteBox.id, {
					width: parseInt(
						ref.style.width
					),
					height: parseInt(
						ref.style.height
					),
					x: position.x,
					y: position.y,
				});
				saveToHistory();
			}}
			scale={canvasTransform.scale}
			minWidth={200}
			minHeight={120}
			style={{
				zIndex: noteBox.zIndex,
				transition: "none",
			}}
			className={`rounded-lg border bg-card transition-all duration-200 ${
				isSelected
					? "border-gray-400 shadow-md"
					: "border-gray-200 hover:border-gray-300 hover:shadow-sm"
			} ${
				!isEditing
					? "hover:cursor-move"
					: ""
			}`}
			dragHandleClassName={
				!isEditing ? "drag-handle" : ""
			}
			disableDragging={isEditing}
			onMouseDown={() => {
				if (!isEditing) {
					onSelect();
					bringToFront(noteBox.id);
				}
			}}
			onContextMenu={handleContextMenu}>
			<div
				ref={containerRef}
				className={`p-3 ${
					!isEditing
						? "drag-handle hover:bg-accent/10 transition-colors"
						: ""
				}`}
				style={{
					cursor: !isEditing
						? "move"
						: "default",
				}}
				onClick={(e) => {
					if (!isEditing) {
						if (
							(
								e.target as HTMLElement
							).closest("a")
						) {
							return;
						}
						setEditingBox(noteBox.id);
					}
				}}
				onDoubleClick={(e) => {
					e.stopPropagation(); // Prevent creating new box when double-clicking on text box
					if (
						(
							e.target as HTMLElement
						).closest("a")
					) {
						return;
					}
					setEditingBox(noteBox.id);
				}}>
				<NoteBoxEditor
					editor={editor}
					slateKey={noteBox.id}
					value={value}
					isEditing={isEditing}
					editorRef={editorRef}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onFocus={() =>
						setEditingBox(noteBox.id)
					}
					onBlur={() =>
						setEditingBox(null)
					}
				/>
			</div>
		</Rnd>
	);
};
