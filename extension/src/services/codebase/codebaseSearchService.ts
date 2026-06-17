import * as vscode from "vscode";

import { WORKSPACE_SEARCH_EXCLUDE_GLOB } from "../../helpers/workspace.js";

export interface NssCodebaseSearchResult {
  readonly path: string;
  readonly preview: string;
}

export async function searchCodebase(query: string, limit = 20): Promise<NssCodebaseSearchResult[]> {
  const results: NssCodebaseSearchResult[] = [];
  const files = await vscode.workspace.findFiles(
    "**/*.{ts,tsx,js,jsx,json,md,css,html,py}",
    WORKSPACE_SEARCH_EXCLUDE_GLOB,
    250,
  );

  const normalizedQuery = query.toLowerCase();
  for (const file of files) {
    const text = Buffer.from(await vscode.workspace.fs.readFile(file)).toString("utf8");
    const matchIndex = text.toLowerCase().indexOf(normalizedQuery);
    if (matchIndex < 0) {
      continue;
    }

    const previewStart = Math.max(0, matchIndex - 80);
    const previewEnd = Math.min(text.length, matchIndex + normalizedQuery.length + 120);
    results.push({
      path: file.fsPath,
      preview: text.slice(previewStart, previewEnd).replace(/\s+/g, " ").trim(),
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}
