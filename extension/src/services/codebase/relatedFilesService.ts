import * as path from "node:path";
import * as vscode from "vscode";

import { WORKSPACE_SEARCH_EXCLUDE_GLOB } from "../../helpers/workspace.js";

export interface NssRelatedFileResult {
  readonly path: string;
  readonly reason: string;
}

export async function findRelatedFiles(uri: vscode.Uri, limit = 10): Promise<NssRelatedFileResult[]> {
  const basename = path.parse(uri.fsPath).name;
  const sameNameMatches = await vscode.workspace.findFiles(
    `**/*${basename}*.*`,
    WORKSPACE_SEARCH_EXCLUDE_GLOB,
    limit * 3,
  );

  const results: NssRelatedFileResult[] = [];
  const seen = new Set<string>();

  for (const match of sameNameMatches) {
    if (match.fsPath === uri.fsPath || seen.has(match.fsPath)) {
      continue;
    }

    seen.add(match.fsPath);
    results.push({
      path: match.fsPath,
      reason: path.dirname(match.fsPath) === path.dirname(uri.fsPath) ? "same folder" : "similar file name",
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}
