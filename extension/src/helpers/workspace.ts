import * as vscode from "vscode";

import { NSS_PRESETS } from "../config/presets.js";
import { STUDIO_PROJECTS } from "../config/studioProjects.js";

export const WORKSPACE_SEARCH_EXCLUDE_GLOB =
  "**/{node_modules,dist,out,build,.git,.next,coverage,venv,.venv,__pycache__,.turbo}/**";

export function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

export function getWorkspaceName(): string {
  return getPrimaryWorkspaceFolder()?.name ?? "Current Workspace";
}

export function inferPresetIdFromPath(input: string | undefined): string {
  return inferIdFromPath(input, NSS_PRESETS.map((preset) => preset.id)) ?? "general-nss-studio";
}

export function inferStudioProjectIdFromPath(input: string | undefined): string {
  return inferIdFromPath(input, STUDIO_PROJECTS.map((project) => project.id)) ?? "general-nss-studio";
}

function inferIdFromPath(input: string | undefined, knownIds: readonly string[]): string | undefined {
  const normalized = (input ?? "").toLowerCase();
  if (normalized.includes("responseos")) {
    return "synox";
  }

  return knownIds.find((id) => normalized.includes(id));
}
