import type { NssDiagnosticSession } from "../../models/diagnostic.types.js";
import type { NssTaskResult } from "../../models/task.types.js";

export function startDiagnosticSessionFromTask(task: NssTaskResult): NssDiagnosticSession {
  const now = new Date().toISOString();
  return {
    id: `diagnostic-${Date.now()}`,
    title: `Diagnostic: ${task.kind}`,
    status: "active",
    summary: task.summary,
    createdAt: now,
    updatedAt: now,
    taskIds: [task.id],
    notes: [],
  };
}

export function addNoteToDiagnosticSession(session: NssDiagnosticSession, note: string): NssDiagnosticSession {
  return {
    ...session,
    notes: [...session.notes, note],
    updatedAt: new Date().toISOString(),
  };
}

export function attachTaskToDiagnosticSession(session: NssDiagnosticSession, task: NssTaskResult): NssDiagnosticSession {
  return {
    ...session,
    taskIds: session.taskIds.includes(task.id) ? session.taskIds : [...session.taskIds, task.id],
    summary: task.summary,
    updatedAt: new Date().toISOString(),
  };
}

export function closeDiagnosticSession(
  session: NssDiagnosticSession,
  status: "abandoned" | "resolved",
): NssDiagnosticSession {
  return {
    ...session,
    status,
    updatedAt: new Date().toISOString(),
  };
}
