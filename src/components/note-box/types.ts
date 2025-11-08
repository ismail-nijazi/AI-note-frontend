import type { BaseEditor } from "slate";
import type { ReactEditor } from "slate-react";

export type CustomText = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	code?: boolean;
	fontSize?: number;
};

export type ListItemElement = {
	type: "list-item";
	children: CustomText[];
};

export type CustomElement =
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

export type NoteEditor = BaseEditor & ReactEditor;

declare module "slate" {
	interface CustomTypes {
		Editor: NoteEditor;
		Element: CustomElement;
		Text: CustomText;
	}
}


