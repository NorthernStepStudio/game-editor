import * as vscode from "vscode";

import type { NssReviewItem } from "../../models/review.types.js";

export async function showReviewDiff(item: NssReviewItem): Promise<void> {
  if (!item.proposedText) {
    throw new Error("This review item does not include concrete proposed text for a diff preview.");
  }

  const left = await vscode.workspace.openTextDocument({
    language: guessLanguage(item.targetPath),
    content: item.originalText,
  });
  const right = await vscode.workspace.openTextDocument({
    language: guessLanguage(item.targetPath),
    content: item.proposedText,
  });

  await vscode.commands.executeCommand(
    "vscode.diff",
    left.uri,
    right.uri,
    `Review Diff: ${item.title}`,
  );
}

function guessLanguage(targetPath: string): string {
  if (targetPath.endsWith(".ts")) {
    return "typescript";
  }
  if (targetPath.endsWith(".tsx")) {
    return "typescriptreact";
  }
  if (targetPath.endsWith(".js")) {
    return "javascript";
  }
  if (targetPath.endsWith(".md")) {
    return "markdown";
  }
  return "plaintext";
}
