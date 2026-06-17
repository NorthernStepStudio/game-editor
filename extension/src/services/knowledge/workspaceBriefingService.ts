import type { NssKnowledgeItem } from "../../models/knowledge.types.js";
import type { NssProjectRule } from "../../models/memory.types.js";
import type { NssRoadmapNote } from "../../models/roadmap.types.js";

export function buildWorkspaceBriefing(input: {
  readonly workspaceName: string;
  readonly modeTitle: string;
  readonly presetTitle: string;
  readonly projectTitle: string;
  readonly projectRules: readonly NssProjectRule[];
  readonly knowledgeItems: readonly NssKnowledgeItem[];
  readonly roadmapNotes: readonly NssRoadmapNote[];
}): string {
  const lines = [
    `Workspace: ${input.workspaceName}`,
    `Mode: ${input.modeTitle}`,
    `Preset: ${input.presetTitle}`,
    `Studio Project: ${input.projectTitle}`,
  ];

  if (input.projectRules.length > 0) {
    lines.push("", "Project rules:", ...input.projectRules.slice(0, 6).map((rule) => `- ${rule.rule}`));
  }

  if (input.knowledgeItems.length > 0) {
    lines.push("", "Knowledge highlights:", ...input.knowledgeItems.slice(0, 5).map((item) => `- ${item.title}`));
  }

  if (input.roadmapNotes.length > 0) {
    lines.push("", "Roadmap notes:", ...input.roadmapNotes.slice(0, 5).map((note) => `- ${note.note}`));
  }

  return lines.join("\n");
}
