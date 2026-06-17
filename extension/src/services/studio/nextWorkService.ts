import type { NssDiagnosticSession } from "../../models/diagnostic.types.js";
import type { NssReviewItem } from "../../models/review.types.js";
import type { NssRoadmapNote } from "../../models/roadmap.types.js";
import type { NssTaskResult } from "../../models/task.types.js";

export function suggestNextWork(input: {
  readonly reviewItems: readonly NssReviewItem[];
  readonly diagnosticSessions: readonly NssDiagnosticSession[];
  readonly taskHistory: readonly NssTaskResult[];
  readonly roadmapNotes: readonly NssRoadmapNote[];
}): string {
  const pendingReview = input.reviewItems.find((item) => item.status === "pending");
  if (pendingReview) {
    return `Review the pending proposal "${pendingReview.title}" before making more changes.`;
  }

  const activeDiagnostic = input.diagnosticSessions.find((session) => session.status === "active");
  if (activeDiagnostic) {
    return `Continue the active diagnostic session "${activeDiagnostic.title}" and capture the next repair note.`;
  }

  const failedTask = input.taskHistory.find((task) => task.status === "failed");
  if (failedTask) {
    return `Follow up on the failed ${failedTask.kind} task and inspect the likely error files first.`;
  }

  const openRoadmapNote = input.roadmapNotes.find((note) => note.status === "open");
  if (openRoadmapNote) {
    return `Work the open roadmap item: ${openRoadmapNote.note}`;
  }

  return "Rebuild knowledge packs or run a focused workflow to decide the next deliberate change.";
}
