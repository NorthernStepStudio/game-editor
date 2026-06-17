import * as vscode from "vscode";

import { analyzeProjectDependencies } from "../codebase/dependencyAnalysisService.js";
import { WORKSPACE_SEARCH_EXCLUDE_GLOB } from "../../helpers/workspace.js";
import { inferWorkspaceCapabilityProfile } from "./workspaceCapabilityService.js";
import type { NssWorkspaceCapabilityProfile } from "../../models/foundation.types.js";

interface PackageSnapshot {
  readonly path: string;
  readonly name: string;
  readonly dependencies: readonly string[];
  readonly scripts: readonly string[];
}

export async function analyzeWorkspaceCapabilityProfile(
  workspaceFolder?: vscode.WorkspaceFolder,
): Promise<NssWorkspaceCapabilityProfile> {
  const workspaceName = workspaceFolder?.name ?? "Current Workspace";
  const workspacePath = workspaceFolder?.uri.fsPath;
  const packageSnapshots = await collectPackageSnapshots();
  const dependencyGraph = await analyzeProjectDependencies();

  return inferWorkspaceCapabilityProfile({
    workspaceName,
    workspacePath,
    packageSnapshots,
    dependencyGraph,
  });
}

async function collectPackageSnapshots(): Promise<PackageSnapshot[]> {
  const packageFiles = await vscode.workspace.findFiles("**/package.json", WORKSPACE_SEARCH_EXCLUDE_GLOB, 100);
  const snapshots: PackageSnapshot[] = [];

  for (const uri of packageFiles) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const json = JSON.parse(doc.getText()) as {
        readonly name?: string;
        readonly dependencies?: Record<string, string>;
        readonly devDependencies?: Record<string, string>;
        readonly peerDependencies?: Record<string, string>;
        readonly scripts?: Record<string, string>;
      };

      const allDeps = {
        ...(json.dependencies ?? {}),
        ...(json.devDependencies ?? {}),
        ...(json.peerDependencies ?? {}),
      };

      snapshots.push({
        path: vscode.workspace.asRelativePath(uri),
        name: json.name ?? vscode.workspace.asRelativePath(uri),
        dependencies: Object.keys(allDeps),
        scripts: Object.keys(json.scripts ?? {}),
      });
    } catch {
      continue;
    }
  }

  return snapshots;
}
