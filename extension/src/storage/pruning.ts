import { limitItems } from "../helpers/limits.js";
import type { NssWorkspaceAiState } from "../state/store.js";
import type { NssStorageLimits } from "./storageLimits.js";

export function pruneWorkspaceState(state: NssWorkspaceAiState, limits: NssStorageLimits): NssWorkspaceAiState {
  return {
    ...state,
    responseHistory: limitItems(state.responseHistory, limits.responseHistory),
    reviewItems: limitItems(state.reviewItems, limits.reviewItems),
    taskHistory: limitItems(state.taskHistory, limits.taskHistory),
    diagnosticSessions: limitItems(state.diagnosticSessions, limits.diagnosticSessions),
    projectRules: limitItems(state.projectRules, limits.projectRules),
    repairPatterns: limitItems(state.repairPatterns, limits.repairPatterns),
    recurringFailures: limitItems(state.recurringFailures, limits.recurringFailures),
    knowledgeItems: limitItems(state.knowledgeItems, limits.knowledgeItems),
    roadmapNotes: limitItems(state.roadmapNotes, limits.roadmapNotes),
  };
}
