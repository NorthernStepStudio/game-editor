import type { NssRecurringFailure } from "../../models/memory.types.js";

export function createRecurringFailure(projectId: string, summary: string): NssRecurringFailure {
  return {
    id: `failure-${Date.now()}`,
    projectId,
    summary,
    createdAt: new Date().toISOString(),
  };
}

export function recallSimilarFailure(
  failures: readonly NssRecurringFailure[],
  query: string,
): NssRecurringFailure | undefined {
  const normalizedQuery = query.toLowerCase();
  return failures.find((failure) => failure.summary.toLowerCase().includes(normalizedQuery));
}
