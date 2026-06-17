import * as vscode from "vscode";

import type { NssTaskKind } from "../models/task.types.js";

export async function pickWorkspaceTaskKind(): Promise<NssTaskKind | undefined> {
  const selection = await vscode.window.showQuickPick(
    [
      { label: "build", description: "Run npm run build" },
      { label: "test", description: "Run npm run test" },
      { label: "lint", description: "Run npm run lint" },
      { label: "typecheck", description: "Run npm run typecheck" },
      { label: "dev", description: "Run npm run dev" },
    ],
    {
      placeHolder: "Choose a safe workspace task to run",
    },
  );

  return selection?.label as NssTaskKind | undefined;
}
