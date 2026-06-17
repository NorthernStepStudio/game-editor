import * as vscode from "vscode";

export interface ActiveFileSnapshot {
  readonly path: string;
  readonly languageId: string;
  readonly content: string;
  readonly selection?: string;
}

export function buildActiveFileSnapshot(editor: vscode.TextEditor): ActiveFileSnapshot {
  const selection = editor.document.getText(editor.selection).trim();

  return {
    path: editor.document.uri.fsPath,
    languageId: editor.document.languageId,
    content: editor.document.getText(),
    selection: selection || undefined,
  };
}

export async function readFileSnapshot(uri: vscode.Uri): Promise<ActiveFileSnapshot> {
  const document = await vscode.workspace.openTextDocument(uri);

  return {
    path: uri.fsPath,
    languageId: document.languageId,
    content: document.getText(),
  };
}

export async function readDirectoryListing(uri: vscode.Uri): Promise<readonly [string, vscode.FileType][]> {
  return vscode.workspace.fs.readDirectory(uri);
}
