import * as vscode from "vscode";

import { WORKSPACE_SEARCH_EXCLUDE_GLOB } from "../../helpers/workspace.js";

export interface CodeSnippet {
  readonly path: string;
  readonly content: string;
  readonly score: number;
}

interface IndexedFile {
  readonly path: string;
  readonly content: string;
  readonly lowerPath: string;
  readonly lowerContent: string;
}

interface WorkspaceIndex {
  readonly rootPath: string;
  readonly indexedAt: string;
  readonly files: readonly IndexedFile[];
}

const workspaceIndexCache = new Map<string, WorkspaceIndex>();

export function clearWorkspaceSearchIndex(rootPath?: string): void {
  if (rootPath) {
    workspaceIndexCache.delete(rootPath);
    return;
  }

  workspaceIndexCache.clear();
}

export async function searchCodebaseKeywords(keywords: readonly string[], maxResults = 5): Promise<CodeSnippet[]> {
  const normalizedKeywords = normalizeKeywords(keywords);
  if (normalizedKeywords.length === 0) {
    return [];
  }

  const workspaceRoot = getWorkspaceRootPath();
  if (!workspaceRoot) {
    return [];
  }

  const index = await getOrBuildWorkspaceIndex(workspaceRoot);
  const results: CodeSnippet[] = [];

  for (const file of index.files) {
    const match = scoreFile(file, normalizedKeywords);
    if (match) {
      results.push(match);
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

export function extractKeywords(prompt: string): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "how",
    "what",
    "where",
    "show",
    "me",
    "this",
    "that",
    "is",
    "are",
    "of",
    "in",
    "for",
    "with",
    "from",
    "into",
    "about",
    "please",
  ]);

  const tokens = new Set<string>();
  const candidates = prompt.toLowerCase().match(/[a-z0-9@/_-]+/g) ?? [];

  for (const candidate of candidates) {
    const parts = candidate.split(/[^a-z0-9]+/g).filter(Boolean);
    for (const part of parts) {
      if (part.length > 2 && !stopWords.has(part)) {
        tokens.add(part);
      }
    }
  }

  return [...tokens].slice(0, 8);
}

async function getOrBuildWorkspaceIndex(rootPath: string): Promise<WorkspaceIndex> {
  const cached = workspaceIndexCache.get(rootPath);
  if (cached) {
    return cached;
  }

  const built = await buildWorkspaceIndex(rootPath);
  workspaceIndexCache.set(rootPath, built);
  return built;
}

async function buildWorkspaceIndex(rootPath: string): Promise<WorkspaceIndex> {
  const includePattern = "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,sql,py,go,rs,css,html}";
  const uris = await vscode.workspace.findFiles(includePattern, WORKSPACE_SEARCH_EXCLUDE_GLOB, 500);
  const files: IndexedFile[] = [];

  for (const uri of uris) {
    try {
      const buffer = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(buffer).toString("utf8");
      if (!content.trim()) {
        continue;
      }

      const path = vscode.workspace.asRelativePath(uri);
      files.push({
        path,
        content,
        lowerPath: path.toLowerCase(),
        lowerContent: content.toLowerCase(),
      });
    } catch {
      continue;
    }
  }

  return {
    rootPath,
    indexedAt: new Date().toISOString(),
    files,
  };
}

function scoreFile(file: IndexedFile, keywords: readonly string[]): CodeSnippet | undefined {
  let score = 0;
  let firstMatchIndex = Number.POSITIVE_INFINITY;

  for (const keyword of keywords) {
    const pathIndex = file.lowerPath.indexOf(keyword);
    if (pathIndex >= 0) {
      score += 4;
      firstMatchIndex = Math.min(firstMatchIndex, pathIndex);
    }

    const contentIndex = file.lowerContent.indexOf(keyword);
    if (contentIndex >= 0) {
      const contentOccurrences = countOccurrences(file.lowerContent, keyword);
      score += 2 + contentOccurrences;
      firstMatchIndex = Math.min(firstMatchIndex, contentIndex);
    }
  }

  if (score <= 0) {
    return undefined;
  }

  const matchIndex = Number.isFinite(firstMatchIndex) ? firstMatchIndex : 0;
  const snippet = buildSnippet(file.content, matchIndex);

  return {
    path: file.path,
    content: snippet,
    score,
  };
}

function buildSnippet(content: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - 200);
  const end = Math.min(content.length, matchIndex + 600);
  const snippet = content.slice(start, end).trim();
  return `${start > 0 ? "... " : ""}${snippet}${end < content.length ? " ..." : ""}`;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let index = 0;
  while (index >= 0) {
    index = haystack.indexOf(needle, index);
    if (index >= 0) {
      count += 1;
      index += needle.length;
    }
  }

  return count;
}

function normalizeKeywords(keywords: readonly string[]): string[] {
  return [...new Set(keywords.map((keyword) => normalizeKeyword(keyword)).filter((keyword) => keyword.length > 0))];
}

function normalizeKeyword(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").trim();
}

function getWorkspaceRootPath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
