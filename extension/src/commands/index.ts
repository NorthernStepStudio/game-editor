import * as vscode from "vscode";

import type { NssCommandHost } from "../models/command.types.js";
import { NSS_COMMANDS } from "./registry.js";

export function registerNssCommands(context: vscode.ExtensionContext, host: NssCommandHost): void {
  for (const command of NSS_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command.id, async () => {
        try {
          await command.run(host);
        } catch (error) {
          await vscode.window.showErrorMessage(error instanceof Error ? error.message : "Matterhorn command failed.");
        }
      }),
    );
  }
}
