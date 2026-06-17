import { DEFAULT_PRESET_ID } from "../config/defaults.js";
import { inferPresetIdFromPath } from "../helpers/workspace.js";

export function resolvePresetSelection(
  currentPresetId: string | undefined,
  workspacePath: string | undefined,
  autoSuggest: boolean,
): string {
  if (currentPresetId) {
    return currentPresetId === "responseos" ? "synox" : currentPresetId;
  }

  if (autoSuggest && workspacePath) {
    return inferPresetIdFromPath(workspacePath);
  }

  return DEFAULT_PRESET_ID;
}
