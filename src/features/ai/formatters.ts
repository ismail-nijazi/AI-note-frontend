import { Descendant } from "slate";
import type { NoteBox } from "@/state/useBoardStore";

export const extractSelectedBoxContent = (
  noteBoxes: NoteBox[],
  selectedBoxId: string | null,
): string | undefined => {
  if (!selectedBoxId) {
    return undefined;
  }

  const selected = noteBoxes.find((box) => box.id === selectedBoxId);
  if (!selected) {
    return undefined;
  }

  return selected.content
    .map((node: Descendant) => {
      if ("text" in node) {
        return node.text;
      }
      if ("children" in node) {
        return node.children
          ?.map((child: Descendant) => ("text" in child ? child.text : ""))
          .join(" ");
      }
      return "";
    })
    .join(" ");
};

export const formatToolSelectionMessage = (
  action: string | undefined,
  message: string | undefined,
  payload: Record<string, unknown>,
): string | undefined => {
  const formatOptions = (items: Array<Record<string, unknown>>): string =>
    items
      .map((item, idx) => {
        const title =
          typeof item.title === "string" ? item.title : `Option ${idx + 1}`;
        const index = typeof item.index === "number" ? item.index : idx;
        const preview =
          typeof item.preview === "string" ? item.preview : undefined;
        const parts = [`${idx + 1}. ${title} (index ${index})`];
        if (preview) {
          parts.push(`   Preview: ${preview}`);
        }
        return parts.join("\n");
      })
      .join("\n");

  if (action === "find_results" && Array.isArray(payload.matches)) {
    const list = formatOptions(
      payload.matches as Array<Record<string, unknown>>,
    );
    return [message || "Here are the boxes I found:", list]
      .filter(Boolean)
      .join("\n");
  }

  if (action === "confirm_selection" && Array.isArray(payload.options)) {
    const list = formatOptions(
      payload.options as Array<Record<string, unknown>>,
    );
    return [message || "Please confirm which box should be updated:", list]
      .filter(Boolean)
      .join("\n");
  }

  return message;
};
