import { DEFAULT_STUDIO_PROJECT_ID } from "../config/defaults.js";
import { inferStudioProjectIdFromPath } from "../helpers/workspace.js";

export function resolveStudioProjectSelection(
  currentProjectId: string | undefined,
  workspacePath: string | undefined,
  autoSuggest: boolean,
): string {
  if (currentProjectId) {
    return currentProjectId === "responseos" ? "synox" : currentProjectId;
  }

  if (autoSuggest && workspacePath) {
    return inferStudioProjectIdFromPath(workspacePath);
  }

  return DEFAULT_STUDIO_PROJECT_ID;
}
