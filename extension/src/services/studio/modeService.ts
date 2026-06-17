import { NSS_MODES } from "../../config/modes.js";
import type { NssModeId } from "../../models/mode.types.js";

const MODE_DETAILS: Record<NssModeId, string> = {
  coding: "Coding mode focuses on implementation, code explanation, and code generation prompts.",
  debugging: "Debugging mode emphasizes task failures, likely error files, and repair trails.",
  product: "Product mode focuses on planning, briefs, and feature framing.",
  marketing: "Marketing mode emphasizes launch copy, positioning, and messaging drafts.",
  research: "Research mode prioritizes understanding, discovery, and documentation review.",
  architect: "Architect mode provides structural analysis, cross-app impact assessment, and deep schema-aware proposals for large-scale changes.",
};

export function getModeTitle(modeId: NssModeId): string {
  return NSS_MODES.find((mode) => mode.id === modeId)?.title ?? modeId;
}

export function getModeDetails(modeId: NssModeId): string {
  return MODE_DETAILS[modeId];
}
