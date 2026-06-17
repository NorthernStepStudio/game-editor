import type { NssCommandDefinition } from "../models/command.types.js";
import abandonSessionCommand from "./abandonSession.command.js";
import addProjectRuleCommand from "./addProjectRule.command.js";
import addNoteToDiagnosticSessionCommand from "./addNoteToDiagnosticSession.command.js";
import addRoadmapNoteCommand from "./addRoadmapNote.command.js";
import applyApprovedReviewItemCommand from "./applyApprovedReviewItem.command.js";
import applyProposedEditToActiveFileCommand from "./applyProposedEditToActiveFile.command.js";
import applyReviewItemToFileCommand from "./applyReviewItemToFile.command.js";
import applyReviewItemToSelectionCommand from "./applyReviewItemToSelection.command.js";
import approveReviewItemCommand from "./approveReviewItem.command.js";
import askAboutCurrentFileCommand from "./askAboutCurrentFile.command.js";
import askAboutErrorFileCommand from "./askAboutErrorFile.command.js";
import askCommand from "./ask.command.js";
import cancelActiveWorkflowCommand from "./cancelActiveWorkflow.command.js";
import clearWorkspaceMemoryCommand from "./clearWorkspaceMemory.command.js";
import compareLastTwoTaskResultsCommand from "./compareLastTwoTaskResults.command.js";
import createNewFileFromLatestResponseCommand from "./createNewFileFromLatestResponse.command.js";
import explainFileCommand from "./explainFile.command.js";
import explainLastTaskFailureCommand from "./explainLastTaskFailure.command.js";
import explainProjectStructureCommand from "./explainProjectStructure.command.js";
import findLikelyErrorFilesCommand from "./findLikelyErrorFiles.command.js";
import findRelatedFilesCommand from "./findRelatedFiles.command.js";
import generateFromSelectionCommand from "./generateFromSelection.command.js";
import insertLatestResponseIntoCurrentFileCommand from "./insertLatestResponseIntoCurrentFile.command.js";
import nextWorkflowStepCommand from "./nextWorkflowStep.command.js";
import openReviewCenterCommand from "./openReviewCenter.command.js";
import openSidebarCommand from "./openSidebar.command.js";
import planChangeCommand from "./planChange.command.js";
import previewReviewItemCommand from "./previewReviewItem.command.js";
import proposeEditForCurrentFileCommand from "./proposeEditForCurrentFile.command.js";
import proposeFixForErrorFileCommand from "./proposeFixForErrorFile.command.js";
import proposeMultiFileChangeCommand from "./proposeMultiFileChange.command.js";
import recallSimilarFailureCommand from "./recallSimilarFailure.command.js";
import rebuildKnowledgePacksCommand from "./rebuildKnowledgePacks.command.js";
import recommendNextWorkCommand from "./recommendNextWork.command.js";
import refreshReviewItemAgainstCurrentFileCommand from "./refreshReviewItemAgainstCurrentFile.command.js";
import rejectReviewItemCommand from "./rejectReviewItem.command.js";
import rerunLastWorkspaceTaskCommand from "./rerunLastWorkspaceTask.command.js";
import resolveSessionCommand from "./resolveSession.command.js";
import runWorkflowCommand from "./runWorkflow.command.js";
import runWorkspaceTaskCommand from "./runWorkspaceTask.command.js";
import saveRepairPatternCommand from "./saveRepairPattern.command.js";
import searchCodebaseCommand from "./searchCodebase.command.js";
import searchKnowledgePacksCommand from "./searchKnowledgePacks.command.js";
import showAvailableWorkflowsCommand from "./showAvailableWorkflows.command.js";
import showCrossProjectSummaryCommand from "./showCrossProjectSummary.command.js";
import showCurrentModeDetailsCommand from "./showCurrentModeDetails.command.js";
import showCurrentPresetCommand from "./showCurrentPreset.command.js";
import showDiffForReviewItemCommand from "./showDiffForReviewItem.command.js";
import showQuickStartCommand from "./showQuickStart.command.js";
import showBuildFoundationCommand from "./showBuildFoundation.command.js";
import showRoadmapNotesForActiveProjectCommand from "./showRoadmapNotesForActiveProject.command.js";
import showStudioDashboardCommand from "./showStudioDashboard.command.js";
import showWorkspaceBriefingCommand from "./showWorkspaceBriefing.command.js";
import startDiagnosticSessionCommand from "./startDiagnosticSession.command.js";
import suggestFixForTaskFailureCommand from "./suggestFixForTaskFailure.command.js";
import suggestPresetForWorkspaceCommand from "./suggestPresetForWorkspace.command.js";
import suggestStudioProjectForWorkspaceCommand from "./suggestStudioProjectForWorkspace.command.js";
import switchActiveStudioProjectCommand from "./switchActiveStudioProject.command.js";
import switchModeCommand from "./switchMode.command.js";
import switchPresetCommand from "./switchPreset.command.js";
import viewActiveDiagnosticSessionCommand from "./viewActiveDiagnosticSession.command.js";

export const NSS_COMMANDS: readonly NssCommandDefinition[] = [
  askCommand,
  explainFileCommand,
  generateFromSelectionCommand,
  askAboutCurrentFileCommand,
  explainProjectStructureCommand,
  proposeEditForCurrentFileCommand,
  proposeMultiFileChangeCommand,
  applyProposedEditToActiveFileCommand,
  insertLatestResponseIntoCurrentFileCommand,
  createNewFileFromLatestResponseCommand,
  openSidebarCommand,
  searchCodebaseCommand,
  findRelatedFilesCommand,
  planChangeCommand,
  runWorkspaceTaskCommand,
  explainLastTaskFailureCommand,
  suggestFixForTaskFailureCommand,
  rerunLastWorkspaceTaskCommand,
  findLikelyErrorFilesCommand,
  askAboutErrorFileCommand,
  proposeFixForErrorFileCommand,
  showQuickStartCommand,
  showBuildFoundationCommand,
  startDiagnosticSessionCommand,
  viewActiveDiagnosticSessionCommand,
  addNoteToDiagnosticSessionCommand,
  compareLastTwoTaskResultsCommand,
  resolveSessionCommand,
  abandonSessionCommand,
  addProjectRuleCommand,
  saveRepairPatternCommand,
  recallSimilarFailureCommand,
  clearWorkspaceMemoryCommand,
  switchActiveStudioProjectCommand,
  showStudioDashboardCommand,
  addRoadmapNoteCommand,
  showRoadmapNotesForActiveProjectCommand,
  recommendNextWorkCommand,
  showCrossProjectSummaryCommand,
  suggestStudioProjectForWorkspaceCommand,
  switchModeCommand,
  showCurrentModeDetailsCommand,
  runWorkflowCommand,
  nextWorkflowStepCommand,
  cancelActiveWorkflowCommand,
  showAvailableWorkflowsCommand,
  switchPresetCommand,
  showCurrentPresetCommand,
  suggestPresetForWorkspaceCommand,
  rebuildKnowledgePacksCommand,
  showWorkspaceBriefingCommand,
  searchKnowledgePacksCommand,
  openReviewCenterCommand,
  previewReviewItemCommand,
  showDiffForReviewItemCommand,
  approveReviewItemCommand,
  rejectReviewItemCommand,
  applyApprovedReviewItemCommand,
  applyReviewItemToSelectionCommand,
  applyReviewItemToFileCommand,
  refreshReviewItemAgainstCurrentFileCommand,
];
