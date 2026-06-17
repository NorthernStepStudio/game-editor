import * as vscode from "vscode";

export function requireActiveEditor(): vscode.TextEditor {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("Open a file in the editor first.");
  }

  return editor;
}

export function getTrimmedSelection(editor: vscode.TextEditor): string {
  return editor.document.getText(editor.selection).trim();
}

export async function insertTextIntoEditor(editor: vscode.TextEditor, text: string): Promise<void> {
  await editor.edit((editBuilder) => {
    if (editor.selection.isEmpty) {
      editBuilder.insert(editor.selection.active, text);
      return;
    }

    editBuilder.replace(editor.selection, text);
  });
}

export async function replaceEditorContent(editor: vscode.TextEditor, text: string): Promise<void> {
  const fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length),
  );

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, text);
  });
}
