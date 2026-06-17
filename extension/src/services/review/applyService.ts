import type * as vscode from "vscode";

import { insertTextIntoEditor, replaceEditorContent } from "../../helpers/editor.js";
import type { NssReviewItem } from "../../models/review.types.js";

export async function applyReviewItemToActiveFile(
  editor: vscode.TextEditor,
  item: NssReviewItem,
): Promise<void> {
  if (!item.proposedText) {
    throw new Error("This proposal does not include a concrete file body to apply.");
  }

  await replaceEditorContent(editor, item.proposedText);
}

export async function applyReviewItemToSelection(
  editor: vscode.TextEditor,
  item: NssReviewItem,
): Promise<void> {
  if (!item.proposedText) {
    throw new Error("This review item does not include concrete text to apply.");
  }

  await insertTextIntoEditor(editor, item.proposedText);
}
