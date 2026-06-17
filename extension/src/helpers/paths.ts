import * as path from "node:path";
import * as vscode from "vscode";

export function toWorkspaceRelativePath(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return uri.fsPath;
  }

  return path.relative(folder.uri.fsPath, uri.fsPath) || path.basename(uri.fsPath);
}
