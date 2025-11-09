import React, {
	useCallback,
	type RefObject,
} from "react";
import {
	Slate,
	Editable,
	type RenderElementProps,
	type RenderLeafProps,
} from "slate-react";
import type { Descendant } from "slate";
import { normalizeUrl } from "./editorUtils";
import type {
	CustomElement,
	CustomText,
	NoteEditor,
} from "./types";

interface NoteBoxEditorProps {
	editor: NoteEditor;
	slateKey: string;
	value: Descendant[];
	isEditing: boolean;
	editorRef: RefObject<HTMLDivElement | null>;
	onChange: (value: Descendant[]) => void;
	onKeyDown: (
		event: React.KeyboardEvent
	) => void;
	onFocus: () => void;
	onBlur: () => void;
}

export const NoteBoxEditor: React.FC<
	NoteBoxEditorProps
> = ({
	editor,
	slateKey,
	value,
	isEditing,
	editorRef,
	onChange,
	onKeyDown,
	onFocus,
	onBlur,
}) => {
	const renderElement = useCallback(
		(props: RenderElementProps) => {
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
							className="bg-muted rounded-md p-3 font-mono text-sm"
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
					const linkClassName =
						isEditing
							? "text-blue-600 underline decoration-dotted"
							: "text-blue-600 underline hover:text-blue-800";
					return (
						<a
							{...props.attributes}
							href={href}
							className={
								linkClassName
							}
							target="_blank"
							rel="noopener noreferrer"
							onMouseDown={(
								event
							) => {
								if (
									(!isEditing &&
										event.metaKey) ||
									event.ctrlKey
								) {
									event.stopPropagation();
								}
							}}
							onClick={(event) => {
								if (isEditing) {
									event.preventDefault();
									if (
										event.metaKey ||
										event.ctrlKey
									) {
										window.open(
											href,
											"_blank",
											"noopener,noreferrer"
										);
									}
									return;
								}

								if (
									!event.metaKey &&
									!event.ctrlKey
								) {
									event.preventDefault();
									window.open(
										href,
										"_blank",
										"noopener,noreferrer"
									);
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
		(props: RenderLeafProps) => {
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

			const style =
				leaf.fontSize &&
				leaf.fontSize !== 14
					? {
							fontSize: `${leaf.fontSize}px`,
					  }
					: undefined;

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

	return (
		<Slate
			key={slateKey}
			editor={editor}
			initialValue={value}
			onChange={onChange}>
			<Editable
				ref={editorRef}
				renderElement={renderElement}
				renderLeaf={renderLeaf}
				placeholder="Start typing..."
				spellCheck
				autoFocus={isEditing}
				onKeyDown={onKeyDown}
				onFocus={onFocus}
				onBlur={onBlur}
				onMouseDown={(event) => {
					const linkTarget = (
						event.target as HTMLElement
					).closest("a");
					if (
						linkTarget &&
						!isEditing
					) {
						event.stopPropagation();
						return;
					}
					if (isEditing) {
						event.stopPropagation();
					}
				}}
				onMouseUp={(event) => {
					if (isEditing) {
						event.stopPropagation();
					}
				}}
				className={`outline-none text-sm leading-relaxed w-full h-full transition-none cursor-text`}
				style={{
					userSelect: isEditing
						? "text"
						: "none",
					pointerEvents: "auto",
					minHeight: "100%",
				}}
			/>
		</Slate>
	);
};
