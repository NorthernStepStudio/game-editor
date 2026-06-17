import type { NssWorkspaceAiState } from "./store.js";

export function clearWorkspaceMemory(state: NssWorkspaceAiState): void {
  state.projectRules = [];
  state.repairPatterns = [];
  state.recurringFailures = [];
  state.roadmapNotes = [];
  state.knowledgeItems = [];
}
