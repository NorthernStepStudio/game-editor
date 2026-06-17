import * as vscode from "vscode";

import { readDirectoryListing } from "../../helpers/files.js";

export async function buildProjectStructureSummary(folder: vscode.WorkspaceFolder): Promise<string> {
  const lines: string[] = [`Workspace root: ${folder.uri.fsPath}`, ""];
  const rootEntries = await readDirectoryListing(folder.uri);
  const visibleEntries = rootEntries
    .filter(([name]) => !name.startsWith("."))
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 10);

  for (const [name, type] of visibleEntries) {
    if (type === vscode.FileType.Directory) {
      const childUri = vscode.Uri.joinPath(folder.uri, name);
      const children = await readDirectoryListing(childUri);
      const preview = children
        .filter(([childName]) => !childName.startsWith("."))
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, 5)
        .map(([childName]) => childName)
        .join(", ");
      lines.push(`- ${name}/ ${preview ? `(${preview})` : ""}`.trim());
      continue;
    }

    lines.push(`- ${name}`);
  }

  return lines.join("\n");
}
