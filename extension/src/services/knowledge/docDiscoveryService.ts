import * as vscode from "vscode";

import { WORKSPACE_SEARCH_EXCLUDE_GLOB } from "../../helpers/workspace.js";

export async function discoverWorkspaceDocs(limit = 30): Promise<readonly vscode.Uri[]> {
  const docFiles = await vscode.workspace.findFiles(
    "**/{README,README.*,docs/**,*.md,*.txt}",
    WORKSPACE_SEARCH_EXCLUDE_GLOB,
    limit,
  );

  return docFiles;
}
