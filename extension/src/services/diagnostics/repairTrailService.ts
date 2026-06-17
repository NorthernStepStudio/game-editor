import type { NssDiagnosticSession } from "../../models/diagnostic.types.js";
import type { NssTaskResult } from "../../models/task.types.js";

export function buildRepairTrail(session: NssDiagnosticSession, tasks: readonly NssTaskResult[]): string {
  const relatedTasks = tasks.filter((task) => session.taskIds.includes(task.id));
  const lines = [`Session: ${session.title}`, `Status: ${session.status}`, ""];

  if (session.notes.length > 0) {
    lines.push("Notes:", ...session.notes.map((note) => `- ${note}`), "");
  }

  if (relatedTasks.length > 0) {
    lines.push("Task trail:", ...relatedTasks.map((task) => `- ${task.kind}: ${task.summary}`));
  }

  return lines.join("\n");
}
