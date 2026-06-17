import * as vscode from "vscode";

import type { NssDebugStateSnapshot } from "../models/debug.types.js";

export interface NssDebugCommandHost {
  getDebugSnapshot(): NssDebugStateSnapshot;
}

export function registerDebugCommands(context: vscode.ExtensionContext, host: NssDebugCommandHost): void {
  if (context.extensionMode === vscode.ExtensionMode.Production) {
    return;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("nssWorkspaceAi.dev.snapshotState", () => {
      return host.getDebugSnapshot();
    }),
  );
}
