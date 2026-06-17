import type { NssDiagnosticSession } from "../../models/diagnostic.types.js";
import type { NssReviewItem } from "../../models/review.types.js";
import type { NssRoadmapNote } from "../../models/roadmap.types.js";
import type { NssTaskResult } from "../../models/task.types.js";

export function buildStudioDashboard(input: {
  readonly workspaceName: string;
  readonly modeTitle: string;
  readonly presetTitle: string;
  readonly projectTitle: string;
  readonly taskHistory: readonly NssTaskResult[];
  readonly reviewItems: readonly NssReviewItem[];
  readonly diagnosticSessions: readonly NssDiagnosticSession[];
  readonly roadmapNotes: readonly NssRoadmapNote[];
}): string {
  const lines = [
    `Workspace: ${input.workspaceName}`,
    `Mode: ${input.modeTitle}`,
    `Preset: ${input.presetTitle}`,
    `Studio Project: ${input.projectTitle}`,
  ];

  if (input.taskHistory.length > 0) {
    lines.push("", "Recent tasks:", ...input.taskHistory.slice(0, 5).map((task) => `- ${task.kind}: ${task.summary}`));
  }

  if (input.reviewItems.length > 0) {
    lines.push("", "Review queue:", ...input.reviewItems.slice(0, 5).map((item) => `- ${item.title} (${item.status})`));
  }

  if (input.diagnosticSessions.length > 0) {
    lines.push("", "Diagnostics:", ...input.diagnosticSessions.slice(0, 5).map((session) => `- ${session.title} (${session.status})`));
  }

  if (input.roadmapNotes.length > 0) {
    lines.push("", "Roadmap:", ...input.roadmapNotes.slice(0, 5).map((note) => `- ${note.note}`));
  }

  return lines.join("\n");
}
