import type { NssAgentId } from "./agent.types.js";

export type NssResponseKind =
  | "answer"
  | "analysis"
  | "briefing"
  | "generation"
  | "plan"
  | "proposal"
  | "task";

export interface NssResponseRecord {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly kind: NssResponseKind;
  readonly sourceCommand: string;
  readonly createdAt: string;
  readonly prompt?: string;
  readonly proposedText?: string;
  readonly preview?: string;
  readonly proposedMemories?: readonly {
    readonly content: string;
    readonly tags: readonly string[];
  }[];
}

export interface NssCommandHost {
  askWorkspaceAi(promptFromSidebar?: string, preferredAgentId?: NssAgentId): Promise<void>;
  explainThisFile(): Promise<void>;
  generateFromSelection(): Promise<void>;
  askAboutCurrentFile(): Promise<void>;
  explainProjectStructure(): Promise<void>;
  proposeEditForCurrentFile(): Promise<void>;
  applyProposedEditToActiveFile(): Promise<void>;
  insertLatestResponseIntoCurrentFile(): Promise<void>;
  createNewFileFromLatestResponse(): Promise<void>;
  openSidebar(): Promise<void>;
  searchCodebaseCommand(): Promise<void>;
  findRelatedFilesCommand(): Promise<void>;
  planChangeCommand(): Promise<void>;
  runWorkspaceTaskCommand(): Promise<void>;
  explainLastTaskFailure(): Promise<void>;
  suggestFixForLastTaskFailure(): Promise<void>;
  rerunLastWorkspaceTask(): Promise<void>;
  findLikelyErrorFiles(): Promise<void>;
  askAboutErrorFileCommand(): Promise<void>;
  proposeFixForErrorFileCommand(): Promise<void>;
  proposeMultiFileChangeCommand(): Promise<void>;
  showQuickStartCommand(): Promise<void>;
  showBuildFoundationCommand(): Promise<void>;
  startDiagnosticSession(): Promise<void>;
  viewActiveDiagnosticSession(): Promise<void>;
  addNoteToSession(): Promise<void>;
  compareLastTwoResultsCommand(): Promise<void>;
  resolveSession(): Promise<void>;
  abandonSession(): Promise<void>;
  addProjectRuleCommand(): Promise<void>;
  saveRepairPatternCommand(): Promise<void>;
  recallSimilarFailureCommand(): Promise<void>;
  clearWorkspaceMemoryCommand(): Promise<void>;
  switchActiveStudioProjectCommand(): Promise<void>;
  showStudioDashboardCommand(): Promise<void>;
  addRoadmapNoteCommand(): Promise<void>;
  showRoadmapNotesForActiveProjectCommand(): Promise<void>;
  whatShouldIWorkOnNextCommand(): Promise<void>;
  showCrossProjectSummaryCommand(): Promise<void>;
  suggestStudioProjectForWorkspaceCommand(): Promise<void>;
  switchModeCommand(): Promise<void>;
  showModeDetailsCommand(): Promise<void>;
  runWorkflowCommand(): Promise<void>;
  nextWorkflowStepCommand(): Promise<void>;
  cancelWorkflowCommand(): Promise<void>;
  showWorkflowsCommand(): Promise<void>;
  switchPresetCommand(): Promise<void>;
  showPresetCommand(): Promise<void>;
  suggestPresetCommand(): Promise<void>;
  rebuildKnowledgePacksCommand(): Promise<void>;
  showBriefingCommand(): Promise<void>;
  searchKnowledgeCommand(): Promise<void>;
  openReviewCenterCommand(): Promise<void>;
  previewReviewItemCommand(): Promise<void>;
  showDiffForReviewItemCommand(): Promise<void>;
  approveReviewItemCommand(): Promise<void>;
  rejectReviewItemCommand(): Promise<void>;
  applyApprovedItemCommand(): Promise<void>;
  applyReviewItemToSelectionCommand(): Promise<void>;
  applyReviewItemToFileCommand(): Promise<void>;
  refreshReviewItemAgainstCurrentFileCommand(): Promise<void>;
}

export type NssCommandMethodName = keyof NssCommandHost;

export interface NssCommandDefinition {
  readonly id: string;
  run(host: NssCommandHost): Promise<void>;
}
