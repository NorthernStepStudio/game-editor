import type { NssTaskResult } from "../models/task.types.js";

export function getLastTask(taskHistory: readonly NssTaskResult[]): NssTaskResult | undefined {
  return taskHistory[0];
}
