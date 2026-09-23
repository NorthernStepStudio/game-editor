import type { NssCommandDefinition } from "../models/command.types.js";
import { classifyTerminalCommand } from "../tools/commandSafety.js";

const runSafeTerminalCommand: NssCommandDefinition = {
  id: "nssWorkspaceAi.runSafeTerminalCommand",
  async run() {
    const vscode = await import("vscode");
    const { formatTerminalCommandResult, runTerminalCommand } = await import("../tools/runTerminalCommand.js");
    const command = await vscode.window.showInputBox({
      prompt: "Command for Matterhorn to run in the current workspace",
      placeHolder: "Example: git status",
      ignoreFocusOut: true,
    });

    if (!command) {
      return;
    }

    const safety = classifyTerminalCommand(command);

    if (safety.level === "block") {
      await vscode.window.showErrorMessage(`Matterhorn blocked this command: ${safety.reason}`);
      return;
    }

    if (safety.level === "confirm") {
      const confirmed = await vscode.window.showWarningMessage(
        `Matterhorn can run this command, but it may change the workspace. ${safety.reason}\n\n${command}`,
        { modal: true },
        "Run Command",
      );

      if (confirmed !== "Run Command") {
        return;
      }
    }

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Matterhorn is running a workspace command",
        cancellable: false,
      },
      async () => runTerminalCommand(command),
    );

    const document = await vscode.workspace.openTextDocument({
      content: formatTerminalCommandResult(result),
      language: "markdown",
    });
    await vscode.window.showTextDocument(document, { preview: false });
  },
};

export default runSafeTerminalCommand;
