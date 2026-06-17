import { NSS_PRESETS } from "../../config/presets.js";

export function getPresetTitle(presetId: string): string {
  const normalizedId = normalizePresetId(presetId);
  return NSS_PRESETS.find((preset) => preset.id === normalizedId)?.title ?? normalizedId;
}

export function suggestPresetIdFromPath(pathValue: string | undefined): string {
  const normalized = (pathValue ?? "").toLowerCase();
  if (normalized.includes("responseos")) {
    return "synox";
  }

  return NSS_PRESETS.map((preset) => preset.id).find((id) => normalized.includes(id)) ?? "general-nss-studio";
}

function normalizePresetId(presetId: string): string {
  return presetId === "responseos" ? "synox" : presetId;
}
