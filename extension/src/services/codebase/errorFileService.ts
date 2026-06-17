import * as path from "node:path";
import * as vscode from "vscode";

import { WORKSPACE_SEARCH_EXCLUDE_GLOB } from "../../helpers/workspace.js";

const FILE_REFERENCE_PATTERN =
  /((?:[A-Za-z]:)?[\\/][^:\r\n]+?\.(?:ts|tsx|js|jsx|json|css|html|md|py)|(?:src|apps|docs|packages)[\\/][^:\r\n]+?\.(?:ts|tsx|js|jsx|json|css|html|md|py))/g;

export async function findLikelyErrorFilesFromOutput(output: string, limit = 8): Promise<string[]> {
  const directMatches = [...output.matchAll(FILE_REFERENCE_PATTERN)]
    .map((match) => match[1])
    .filter(Boolean);

  const normalizedMatches = dedupeAndNormalizePaths(directMatches);
  if (normalizedMatches.length > 0) {
    return normalizedMatches.slice(0, limit);
  }

  const fallbackQuery = extractFallbackQuery(output);
  if (!fallbackQuery) {
    return [];
  }

  const searchMatches = await vscode.workspace.findFiles(
    `**/*${fallbackQuery}*.*`,
    WORKSPACE_SEARCH_EXCLUDE_GLOB,
    limit,
  );
  return searchMatches.map((uri) => uri.fsPath);
}

function dedupeAndNormalizePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const value of paths) {
    const normalized = value.replace(/\//g, path.sep).trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    resolved.push(normalized);
  }

  return resolved;
}

function extractFallbackQuery(output: string): string | undefined {
  const match = output.match(/(?:module|file|import)\s+['"]?([A-Za-z0-9_.-]{3,})/i);
  return match?.[1];
}
