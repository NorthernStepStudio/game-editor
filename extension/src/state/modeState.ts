import { DEFAULT_MODE } from "../config/defaults.js";
import type { NssModeId } from "../models/mode.types.js";

export function resolveModeSelection(currentMode: NssModeId | undefined, fallbackMode: NssModeId = DEFAULT_MODE): NssModeId {
  return currentMode ?? fallbackMode;
}
