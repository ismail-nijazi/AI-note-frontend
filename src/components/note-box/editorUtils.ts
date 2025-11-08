import {
	createEditor,
	Descendant,
	Editor,
	Element as SlateElement,
	Range,
	Transforms,
} from "slate";
import { withReact } from "slate-react";
import { withHistory } from "slate-history";
import type { CustomElement, NoteEditor } from "./types";

const URL_PROTOCOL_REGEX =
	/^[a-zA-Z][\w+.-]*:\/\//;
const URL_WITHOUT_SPACES_REGEX =
	/^(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})(?:[/?#][^\s]*)?$/;

export const normalizeUrl = (url: string): string => {
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

export const isUrl = (value: string): boolean => {
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

const withInlines = (editor: NoteEditor) => {
	const { insertData, isInline } = editor;

	editor.isInline = (element) =>
		(element as CustomElement).type === "link"
			? true
			: isInline(element);

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

export const createNoteBoxEditor = (): NoteEditor =>
	withInlines(
		withHistory(withReact(createEditor()))
	) as NoteEditor;

export const cloneContent = (
	content: Descendant[]
): Descendant[] =>
	JSON.parse(
		JSON.stringify(
			Array.isArray(content) ? content : []
		)
	);

const isLinkActive = (editor: Editor) => {
	const [match] = Editor.nodes(editor, {
		match: (n) =>
			!Editor.isEditor(n) &&
			SlateElement.isElement(n) &&
			(n as CustomElement).type === "link",
	});

	return !!match;
};

export const unwrapLink = (editor: Editor) => {
	Transforms.unwrapNodes(editor, {
		match: (n) =>
			!Editor.isEditor(n) &&
			SlateElement.isElement(n) &&
			(n as CustomElement).type === "link",
		split: true,
	});
};

export const wrapLink = (
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

export const ensureLinkForSelection = (
	editor: Editor,
	url: string
) => {
	wrapLink(editor, url);
};


