import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import type { NssStateStore } from "../state/store.js";
import { getTrimmedSelection, requireActiveEditor } from "../helpers/editor.js";
import { toWorkspaceRelativePath } from "../helpers/paths.js";

export function registerMemoryCommands(context: vscode.ExtensionContext, store: NssStateStore) {
  context.subscriptions.push(
    vscode.commands.registerCommand("nssWorkspaceAi.rememberSelection", async () => {
      const editor = requireActiveEditor();
      const selection = getTrimmedSelection(editor);
      if (!selection) {
        vscode.window.showWarningMessage("Select some text for Matterhorn to remember.");
        return;
      }

      const tagsInput = await vscode.window.showInputBox({
        prompt: "Enter tags for this memory (comma separated)",
        placeHolder: "e.g. styling, layout, header",
      });

      const tags = tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(Boolean) : [];
      const state = store.snapshot();

      await store.update((draft) => {
        draft.persistentMemories.push({
          id: randomUUID(),
          projectId: state.studioProjectId,
          tags,
          content: selection,
          importance: 3,
          createdAt: new Date().toISOString(),
        });
      });

      vscode.window.showInformationMessage(`Matterhorn remembered this selection from ${toWorkspaceRelativePath(editor.document.uri)}.`);
    }),

    vscode.commands.registerCommand("nssWorkspaceAi.showMemories", async () => {
      const state = store.snapshot();
      const memories = state.persistentMemories.filter(m => m.projectId === state.studioProjectId);

      if (memories.length === 0) {
        vscode.window.showInformationMessage("Matterhorn hasn't remembered anything for this project yet.");
        return;
      }

      const picked = await vscode.window.showQuickPick(
        memories.map(m => ({
          label: m.tags.join(", ") || "No tags",
          description: m.content.substring(0, 100).replace(/\n/g, " "),
          memory: m,
        })),
        { placeHolder: "Select a memory to view or delete" }
      );

      if (!picked) return;

      const action = await vscode.window.showQuickPick(["View", "Delete"], {
        placeHolder: `Memory: ${picked.label}`,
      });

      if (action === "View") {
        const doc = await vscode.workspace.openTextDocument({
          content: picked.memory.content,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc);
      } else if (action === "Delete") {
        await store.update((draft) => {
          draft.persistentMemories = draft.persistentMemories.filter(m => m.id !== picked.memory.id);
        });
        vscode.window.showInformationMessage("Matterhorn has forgotten that memory.");
      }
    })
  );
}
