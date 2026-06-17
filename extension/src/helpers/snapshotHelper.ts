import * as vscode from "vscode";
import { NssAppSnapshot } from "../models/api.types";

export async function generateAppSnapshot(workspaceRoot: string): Promise<NssAppSnapshot> {
  let structureSummary = "Project Structure:\n";
  
  try {
    const files = await vscode.workspace.findFiles("**/*", "**/node_modules/**", 100);
    const structure = files
      .map(f => vscode.workspace.asRelativePath(f))
      .sort()
      .join("\n");
      
    structureSummary += structure || "No files found in workspace root.";
  } catch (error) {
    structureSummary += `Error generating structure: ${error instanceof Error ? error.message : String(error)}`;
  }

  return {
    structureSummary,
    activeFile: vscode.window.activeTextEditor?.document.fileName 
      ? vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.fileName) 
      : undefined
  };
}
