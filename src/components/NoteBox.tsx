import React, {
	useCallback,
	useMemo,
	useRef,
	useEffect,
	useState,
} from "react";
import { Rnd } from "react-rnd";
import {
	createEditor,
	Descendant,
	Editor,
	Transforms,
	Element as SlateElement,
	BaseEditor,
	Range,
} from "slate";
import {
	Slate,
	Editable,
	withReact,
	ReactEditor,
} from "slate-react";
import { withHistory } from "slate-history";
import {
	useBoardStore,
	NoteBox as NoteBoxType,
} from "@/state/useBoardStore";

// Define custom types for Slate elements
type CustomElement =
	| {
			type: "paragraph";
			children: CustomText[];
	  }
	| {
			type: "heading-one";
			children: CustomText[];
	  }
	| {
			type: "heading-two";
			children: CustomText[];
	  }
	| {
			type: "block-quote";
			children: CustomText[];
	  }
	| {
			type: "code-block";
			children: CustomText[];
	  }
	| {
			type: "bulleted-list";
			children: ListItemElement[];
	  }
	| {
			type: "numbered-list";
			children: ListItemElement[];
	  }
	| {
			type: "list-item";
			children: CustomText[];
	  }
	| {
			type: "link";
			url: string;
			children: CustomText[];
	  }
	| {
			type: "image";
			url: string;
			children: CustomText[];
	  };

type ListItemElement = {
	type: "list-item";
	children: CustomText[];
};

type CustomText = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	code?: boolean;
	fontSize?: number;
};

declare module "slate" {
	interface CustomTypes {
		Editor: BaseEditor & ReactEditor;
		Element: CustomElement;
		Text: CustomText;
	}
}

interface NoteBoxProps {
	noteBox: NoteBoxType;
	isSelected: boolean;
	onSelect: () => void;
	onFormatChange: (callbacks: any) => void;
}

const withInlines = (
	editor: BaseEditor & ReactEditor
) => {
	const { insertData, isInline } = editor;

	editor.isInline = (element) => {
		return (element as CustomElement).type ===
			"link"
			? true
			: isInline(element);
	};

	editor.insertData = (data) => {
		const text = data.getData("text/plain");
		if (text && isUrl(text.trim())) {
			const trimmed = text.trim();
			wrapLink(editor, trimmed, trimmed);
			return;
		}
		insertData(data);
	};

	return editor;
};

const URL_PROTOCOL_REGEX =
	/^[a-zA-Z][\w+.-]*:\/\//;
const URL_WITHOUT_SPACES_REGEX =
	/^(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})(?:[/?#][^\s]*)?$/;

const normalizeUrl = (url: string): string => {
	let trimmed = url.trim();
	if (!trimmed) return "";

	if (!URL_PROTOCOL_REGEX.test(trimmed)) {
		trimmed = `https://${trimmed.replace(
			/^\/+/,
			""
		)}`;
	}

	return trimmed;
};

const isUrl = (value: string): boolean => {
	const trimmed = value.trim();
	if (!trimmed || /\s/.test(trimmed)) {
		return false;
	}

	if (
		!URL_WITHOUT_SPACES_REGEX.test(trimmed) &&
		!URL_PROTOCOL_REGEX.test(trimmed)
	) {
		return false;
	}

	const normalized = normalizeUrl(trimmed);

	try {
		const parsed = new URL(normalized);
		return (
			parsed.protocol === "http:" ||
			parsed.protocol === "https:"
		);
	} catch {
		return false;
	}
};

const isLinkActive = (editor: Editor) => {
	const [match] = Editor.nodes(editor, {
		match: (n) =>
			!Editor.isEditor(n) &&
			SlateElement.isElement(n) &&
			(n as CustomElement).type === "link",
	});

	return !!match;
};

const unwrapLink = (editor: Editor) => {
	Transforms.unwrapNodes(editor, {
		match: (n) =>
			!Editor.isEditor(n) &&
			SlateElement.isElement(n) &&
			(n as CustomElement).type === "link",
		split: true,
	});
};

const wrapLink = (
	editor: Editor,
	url: string,
	displayText?: string
) => {
	const normalizedUrl = normalizeUrl(url);

	if (!normalizedUrl || !isUrl(normalizedUrl)) {
		return;
	}

	if (isLinkActive(editor)) {
		unwrapLink(editor);
	}

	const { selection } = editor;

	if (!selection) {
		return;
	}

	const isCollapsed =
		Range.isCollapsed(selection);

	if (isCollapsed) {
		const text =
			displayText?.trim() || normalizedUrl;
		const link: CustomElement = {
			type: "link",
			url: normalizedUrl,
			children: [{ text }],
		};

		Transforms.insertNodes(editor, link);
	} else {
		const link: CustomElement = {
			type: "link",
			url: normalizedUrl,
			children: [],
		};

		Transforms.wrapNodes(editor, link, {
			split: true,
		});
		Transforms.collapse(editor, {
			edge: "end",
		});
	}
};

const ensureLinkForSelection = (
	editor: Editor,
	url: string
) => {
	wrapLink(editor, url);
};

const cloneContent = (
	content: Descendant[]
): Descendant[] =>
	JSON.parse(
		JSON.stringify(
			Array.isArray(content) ? content : []
		)
	);

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
		saveToHistory,
		canvasTransform,
		editingBoxId,
		setEditingBox,
	} = useBoardStore();
	const editorRef =
		useRef<HTMLDivElement | null>(null);

	// Use global editing state
	const isEditing = editingBoxId === noteBox.id;

	const editor = useMemo(
		() =>
			withInlines(
				withHistory(
					withReact(createEditor())
				)
			),
		[]
	);
	const [value, setValue] = useState<
		Descendant[]
	>(() => cloneContent(noteBox.content));

	useEffect(() => {
		console.log("[NoteBox] content debug", {
			id: noteBox.id,
			isEditing,
			isArray: Array.isArray(
				noteBox.content
			),
			rawContent: noteBox.content,
			clonedContent: cloneContent(
				noteBox.content
			),
		});
	}, [noteBox.id, noteBox.content, isEditing]);

	const isMarkActive = (format: string) => {
		const marks = Editor.marks(editor);
		return marks
			? marks[
					format as keyof CustomText
			  ] === true
			: false;
	};

	const isBlockActive = (format: string) => {
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
					SlateElement.isElement(n) &&
					(n as CustomElement).type ===
						format,
			})
		);

		return !!match;
	};

	const toggleMark = (format: string) => {
		const isActive = isMarkActive(format);
		if (isActive) {
			Editor.removeMark(editor, format);
		} else {
			Editor.addMark(editor, format, true);
		}
	};

	const toggleBlock = (format: string) => {
		const isActive = isBlockActive(format);
		const isList = [
			"numbered-list",
			"bulleted-list",
		].includes(format);

		Transforms.unwrapNodes(editor, {
			match: (n) =>
				!Editor.isEditor(n) &&
				SlateElement.isElement(n) &&
				[
					"numbered-list",
					"bulleted-list",
				].includes(
					(n as CustomElement).type
				),
			split: true,
		});

		const newProperties: Partial<CustomElement> =
			{
				type: isActive
					? "paragraph"
					: isList
					? "list-item"
					: format,
			} as Partial<CustomElement>;
		Transforms.setNodes<CustomElement>(
			editor,
			newProperties
		);

		if (!isActive && isList) {
			const block: CustomElement = {
				type: format as any,
				children: [],
			};
			Transforms.wrapNodes(editor, block);
		}
	};

	const insertLink = () => {
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
	};

	const removeLink = () => {
		unwrapLink(editor);
	};

	const insertImage = () => {
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
	};

	const formatCallbacks = {
		onBold: () => toggleMark("bold"),
		onItalic: () => toggleMark("italic"),
		onUnderline: () =>
			toggleMark("underline"),
		onStrikethrough: () =>
			toggleMark("strikethrough"),
		onFontSize: (size: string) => {
			// Remove existing fontSize mark and apply new one
			Editor.removeMark(editor, "fontSize");
			const fontSize = parseInt(size);
			if (fontSize !== 14) {
				// 14 is default, don't store it
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
		onQuote: () => toggleBlock("block-quote"),
		onCode: () => toggleMark("code"),
		onCodeBlock: () =>
			toggleBlock("code-block"),
		onLink: insertLink,
		onUnlink: removeLink,
		onImage: insertImage,
		getCurrentFontSize: () => {
			const marks = Editor.marks(editor);
			if (!marks || !marks.fontSize)
				return "14";
			return marks.fontSize.toString();
		},
		isFormatActive: (format: string) => {
			if (
				[
					"bold",
					"italic",
					"underline",
					"strikethrough",
					"code",
				].includes(format)
			) {
				return isMarkActive(format);
			}
			return isBlockActive(format);
		},
	};

	useEffect(() => {
		if (isSelected) {
			onFormatChange(formatCallbacks);
		}
	}, [isSelected, editor.selection]);

	const renderElement = useCallback(
		(props: any) => {
			const element =
				props.element as CustomElement;
			switch (element.type) {
				case "block-quote":
					return (
						<blockquote
							className="border-l-4 border-border pl-4 italic text-muted-foreground"
							{...props.attributes}>
							{props.children}
						</blockquote>
					);
				case "bulleted-list":
					return (
						<ul
							className="list-disc pl-6"
							{...props.attributes}>
							{props.children}
						</ul>
					);
				case "numbered-list":
					return (
						<ol
							className="list-decimal pl-6"
							{...props.attributes}>
							{props.children}
						</ol>
					);
				case "list-item":
					return (
						<li {...props.attributes}>
							{props.children}
						</li>
					);
				case "heading-one":
					return (
						<h1
							className="text-2xl font-bold mb-2"
							{...props.attributes}>
							{props.children}
						</h1>
					);
				case "heading-two":
					return (
						<h2
							className="text-xl font-semibold mb-2"
							{...props.attributes}>
							{props.children}
						</h2>
					);
				case "code-block":
					return (
						<pre
							className="bg-muted p-2 rounded font-mono text-sm overflow-x-auto"
							{...props.attributes}>
							<code>
								{props.children}
							</code>
						</pre>
					);
				case "link": {
					const href = normalizeUrl(
						element.url
					);
					return (
						<a
							{...props.attributes}
							href={href}
							className="text-blue-600 underline hover:text-blue-800"
							target="_blank"
							rel="noopener noreferrer"
							onMouseDown={(
								event
							) => {
								if (
									!isEditing ||
									event.metaKey ||
									event.ctrlKey
								) {
									event.stopPropagation();
								}
							}}
							onClick={(event) => {
								const shouldOpen =
									(!isEditing &&
										!event.shiftKey) ||
									event.metaKey ||
									event.ctrlKey;

								if (shouldOpen) {
									event.preventDefault();
									window.open(
										href,
										"_blank",
										"noopener,noreferrer"
									);
								} else if (
									isEditing
								) {
									event.preventDefault();
								}
							}}>
							{props.children}
						</a>
					);
				}
				case "image":
					return (
						<div
							{...props.attributes}>
							{props.children}
							<img
								src={element.url}
								alt=""
								className="max-w-full h-auto rounded border"
								contentEditable={
									false
								}
							/>
						</div>
					);
				default:
					return (
						<p {...props.attributes}>
							{props.children}
						</p>
					);
			}
		},
		[isEditing]
	);

	const renderLeaf = useCallback(
		(props: any) => {
			let { children } = props;
			const leaf = props.leaf as CustomText;

			if (leaf.bold) {
				children = (
					<strong>{children}</strong>
				);
			}

			if (leaf.italic) {
				children = <em>{children}</em>;
			}

			if (leaf.underline) {
				children = <u>{children}</u>;
			}

			if (leaf.strikethrough) {
				children = <s>{children}</s>;
			}

			if (leaf.code) {
				children = (
					<code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
						{children}
					</code>
				);
			}

			// Handle font sizes
			let style = {};
			if (
				leaf.fontSize &&
				leaf.fontSize !== 14
			) {
				style = {
					fontSize: `${leaf.fontSize}px`,
				};
			}

			return (
				<span
					{...props.attributes}
					style={style}>
					{children}
				</span>
			);
		},
		[]
	);

	const handleChange = useCallback(
		(newValue: Descendant[]) => {
			const clonedValue =
				cloneContent(newValue);
			setValue(clonedValue);
			updateNoteBox(noteBox.id, {
				content: clonedValue,
			});
		},
		[noteBox.id, updateNoteBox]
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
		if (isEditing) {
			setValue(
				cloneContent(noteBox.content)
			);
		}
	}, [isEditing, noteBox.content]);

	useEffect(() => {
		setValue(cloneContent(noteBox.content));
	}, [noteBox.id]);

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
				noteBox.content.length > 1 ||
				(noteBox.content[0] as any)
					?.children?.[0]?.text !==
					"Start typing...";
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

		const actions = [
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
				action: () => {
					/* sendToBack not implemented in store */
				},
			},
			{
				label: "Delete",
				action: () => {
					const hasContent =
						noteBox.content.length >
							1 ||
						(
							noteBox
								.content[0] as any
						)?.children?.[0]?.text !==
							"Start typing...";
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
			minHeight={100}
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
			onMouseDown={() => {
				if (!isEditing) {
					onSelect();
					bringToFront(noteBox.id);
				}
			}}
			onContextMenu={handleContextMenu}>
			<div
				className={`h-full p-3 overflow-y-auto no-scrollbar ${
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
				<Slate
					key={noteBox.id}
					editor={editor}
					initialValue={value}
					onChange={handleChange}>
					<Editable
						ref={editorRef}
						renderElement={
							renderElement
						}
						renderLeaf={renderLeaf}
						placeholder="Start typing..."
						spellCheck
						autoFocus={isEditing}
						onKeyDown={handleKeyDown}
						onFocus={() =>
							setEditingBox(
								noteBox.id
							)
						}
						onBlur={() =>
							setEditingBox(null)
						}
						onMouseDown={(e) => {
							const linkTarget = (
								e.target as HTMLElement
							).closest("a");
							if (
								linkTarget &&
								!isEditing
							) {
								e.stopPropagation();
								return;
							}
							if (isEditing) {
								e.stopPropagation(); // Prevent dragging when editing text
							}
						}}
						onMouseUp={(e) => {
							if (isEditing) {
								e.stopPropagation(); // Prevent any interference with text selection
							}
						}}
						className={`outline-none text-sm leading-relaxed ${
							isEditing
								? "cursor-text"
								: "cursor-move drag-handle"
						}`}
						style={{
							userSelect: isEditing
								? "text"
								: "none",
							pointerEvents: "auto",
						}}
					/>
				</Slate>
			</div>
		</Rnd>
	);
};
