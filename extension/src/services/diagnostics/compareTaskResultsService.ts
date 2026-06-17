import type { NssTaskResult } from "../../models/task.types.js";

export function compareTaskResults(previousTask: NssTaskResult, currentTask: NssTaskResult): string {
  const lines = [
    `Previous: ${previousTask.kind} (${previousTask.status}, exit ${previousTask.exitCode ?? "unknown"})`,
    `Current: ${currentTask.kind} (${currentTask.status}, exit ${currentTask.exitCode ?? "unknown"})`,
    "",
    `Previous summary: ${previousTask.summary}`,
    `Current summary: ${currentTask.summary}`,
  ];

  if (currentTask.likelyErrorFiles.length > 0) {
    lines.push("", "Current likely error files:", ...currentTask.likelyErrorFiles.map((file) => `- ${file}`));
  }

  return lines.join("\n");
}
