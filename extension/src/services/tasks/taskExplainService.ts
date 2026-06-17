import type { NssTaskResult } from "../../models/task.types.js";

export function explainTaskResult(task: NssTaskResult): string {
  const lines = [
    `Task: ${task.kind}`,
    `Status: ${task.status}`,
    `Command: ${task.commandLine}`,
    `Exit code: ${task.exitCode ?? "unknown"}`,
    "",
    "Summary:",
    task.summary,
  ];

  if (task.stderr.trim()) {
    lines.push("", "Error output:", task.stderr.trim());
  }

  if (task.likelyErrorFiles.length > 0) {
    lines.push("", "Likely error files:", ...task.likelyErrorFiles.map((file) => `- ${file}`));
  }

  return lines.join("\n");
}
