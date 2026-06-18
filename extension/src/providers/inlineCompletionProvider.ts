import * as vscode from "vscode";

import { postAskRequest } from "../api/client.js";
import { getRuntimeConfig } from "../helpers/config.js";

/**
 * Matterhorn inline completion provider — ghost-text suggestions powered
 * by the local Matterhorn server. Triggers on automatic (idle) completions,
 * debounced to avoid hammering the server on every keystroke.
 */
export class MatterhornInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly debounceMs = 700;
  private lastCompletionText: string | undefined;

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionList | null> {
    // Skip blank / very short lines — not worth a round-trip
    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    if (linePrefix.trim().length < 4) {
      return null;
    }

    // Debounce: wait for the user to pause typing
    const debounced = await new Promise<boolean>((resolve) => {
      clearTimeout(this.debounceTimer);
      const cancelled = token.onCancellationRequested(() => {
        cancelled.dispose();
        resolve(false);
      });
      this.debounceTimer = setTimeout(() => {
        cancelled.dispose();
        resolve(true);
      }, this.debounceMs);
    });

    if (!debounced || token.isCancellationRequested) {
      return null;
    }

    try {
      const config = getRuntimeConfig();
      const fileContent = document.getText();
      const cursorOffset = document.offsetAt(position);
      const prefix = fileContent.slice(0, cursorOffset);
      const suffix = fileContent.slice(cursorOffset, cursorOffset + 300);

      const prompt = [
        `Complete the following ${document.languageId} code at the cursor position [CURSOR].`,
        `Output ONLY the completion text to insert — no explanation, no markdown fences, no repeated prefix.`,
        ``,
        prefix.slice(-1200),
        `[CURSOR]`,
        suffix,
      ].join("\n");

      const response = await postAskRequest(config, {
        prompt,
        intent: "generate-from-selection",
        workspace: { name: vscode.workspace.name ?? "workspace" },
        preferredAgentId: "stack-expert",
        activeFile: {
          path: document.uri.fsPath,
          languageId: document.languageId,
          content: fileContent.slice(0, 4000),
          selection: prefix.split("\n").slice(-8).join("\n"),
        },
      });

      if (token.isCancellationRequested) {
        return null;
      }

      const completionText = extractCompletionText(response.response ?? response.proposedText ?? "");
      if (!completionText || completionText === this.lastCompletionText) {
        return null;
      }

      this.lastCompletionText = completionText;

      return {
        items: [
          new vscode.InlineCompletionItem(
            completionText,
            new vscode.Range(position, position),
          ),
        ],
      };
    } catch {
      return null;
    }
  }
}

function extractCompletionText(raw: string): string {
  if (!raw?.trim()) return "";

  // Strip markdown code fences if present
  const fenceMatch = raw.match(/^```[\w]*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch?.[1]) return fenceMatch[1];

  // Strip JSON envelope if the provider returned structured output
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const text =
      (typeof parsed.proposedText === "string" ? parsed.proposedText : undefined) ??
      (typeof parsed.response === "string" ? parsed.response : undefined);
    if (text) return text.trim();
  } catch {}

  return raw.trim();
}
