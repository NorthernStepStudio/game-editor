import type { NssProjectRule, NssRecurringFailure, NssRepairPattern, NssPersistentMemory } from "../../models/memory.types.js";

export function buildWorkspaceMemoryContext(input: {
  readonly projectRules: readonly NssProjectRule[];
  readonly repairPatterns: readonly NssRepairPattern[];
  readonly recurringFailures: readonly NssRecurringFailure[];
  readonly persistentMemories?: readonly NssPersistentMemory[];
  readonly projectId: string;
}): {
  readonly projectRules: readonly string[];
  readonly repairPatterns: readonly string[];
  readonly recurringFailures: readonly string[];
  readonly persistent?: readonly string[];
} {
  return {
    projectRules: input.projectRules
      .filter((rule) => rule.projectId === input.projectId)
      .map((rule) => rule.rule)
      .slice(0, 6),
    repairPatterns: input.repairPatterns
      .filter((pattern) => pattern.projectId === input.projectId)
      .map((pattern) => `${pattern.title}: ${pattern.fix}`)
      .slice(0, 4),
    recurringFailures: input.recurringFailures
      .filter((failure) => failure.projectId === input.projectId)
      .map((failure) => failure.summary)
      .slice(0, 4),
    persistent: input.persistentMemories
      ?.map((memory) => `[RECALLED] ${memory.tags.join(", ")}: ${memory.content}`)
      .slice(0, 8),
  };
}
