import type { NssDiagnosticSession } from "../../models/diagnostic.types.js";
import type { NssRepairPattern } from "../../models/memory.types.js";

export function createRepairPattern(projectId: string, session: NssDiagnosticSession): NssRepairPattern {
  return {
    id: `pattern-${Date.now()}`,
    projectId,
    title: session.title,
    symptom: session.summary,
    fix: session.notes[session.notes.length - 1] ?? "Review the linked task results and notes.",
    createdAt: new Date().toISOString(),
  };
}
