import type { NssModeId } from "../models/mode.types.js";
import type { NssSidebarQuickAction } from "../models/sidebar.types.js";

export const COMMAND_NAMESPACE = "nssWorkspaceAi";

export interface BuildSidebarQuickActionsInput {
  readonly mode: NssModeId;
  readonly hasActiveReview: boolean;
  readonly hasFailedTask: boolean;
  readonly hasActiveWorkflow: boolean;
  readonly hasActiveDiagnostic: boolean;
}

const MODE_ACTIONS: Record<NssModeId, readonly NssSidebarQuickAction[]> = {
  coding: [
    { command: "nssWorkspaceAi.explainThisFile", label: "Explain File" },
    { command: "nssWorkspaceAi.proposeEditForCurrentFile", label: "Propose Edit" },
    { command: "nssWorkspaceAi.proposeMultiFileChange", label: "Multi-File Change" },
    { command: "nssWorkspaceAi.searchCodebase", label: "Search Code" },
  ],
  debugging: [
    { command: "nssWorkspaceAi.runWorkspaceTask", label: "Run Task" },
    { command: "nssWorkspaceAi.explainLastTaskFailure", label: "Explain Failure" },
    { command: "nssWorkspaceAi.findLikelyErrorFiles", label: "Likely Error Files" },
    { command: "nssWorkspaceAi.proposeFixForErrorFile", label: "Propose Error Fix" },
  ],
  product: [
    { command: "nssWorkspaceAi.showStudioDashboard", label: "Studio Dashboard" },
    { command: "nssWorkspaceAi.planChange", label: "Plan Change" },
    { command: "nssWorkspaceAi.showBuildFoundation", label: "Build Foundation" },
    { command: "nss.runWorkflow", label: "Run Workflow" },
    { command: "nssWorkspaceAi.whatShouldIWorkOnNext", label: "Next Work" },
  ],
  marketing: [
    { command: "nss.runWorkflow", label: "Run Workflow" },
    { command: "nss.showBriefing", label: "Workspace Briefing" },
    { command: "nssWorkspaceAi.showCrossProjectSummary", label: "Cross-Project Summary" },
    { command: "nssWorkspaceAi.askWorkspaceAi", label: "Ask Matterhorn" },
  ],
  research: [
    { command: "nss.searchKnowledge", label: "Search Knowledge" },
    { command: "nss.showBriefing", label: "Workspace Briefing" },
    { command: "nssWorkspaceAi.explainProjectStructure", label: "Explain Project" },
    { command: "nssWorkspaceAi.askWorkspaceAi", label: "Ask Matterhorn" },
  ],
  architect: [
    { command: "nssWorkspaceAi.explainProjectStructure", label: "Explain Structure" },
    { command: "nssWorkspaceAi.proposeMultiFileChange", label: "Multi-File Change" },
    { command: "nssWorkspaceAi.planChange", label: "Plan Change" },
    { command: "nssWorkspaceAi.showBuildFoundation", label: "Build Foundation" },
    { command: "nssWorkspaceAi.searchCodebase", label: "Search Codebase" },
  ],
};

export function buildSidebarQuickActions(input: BuildSidebarQuickActionsInput): readonly NssSidebarQuickAction[] {
  const actions: NssSidebarQuickAction[] = [...MODE_ACTIONS[input.mode]];

  if (input.hasFailedTask) {
    actions.push(
      { command: "nssWorkspaceAi.findLikelyErrorFiles", label: "Likely Error Files" },
      { command: "nssWorkspaceAi.askAboutErrorFile", label: "Ask About Error File" },
      { command: "nssWorkspaceAi.proposeFixForErrorFile", label: "Propose Error Fix" },
    );
  }

  if (input.hasActiveReview) {
    actions.push(
      { command: "nss.openReviewCenter", label: "Review Center" },
      { command: "nss.previewReviewItem", label: "Preview Review" },
    );
  }

  if (input.hasActiveWorkflow) {
    actions.push(
      { command: "nss.nextWorkflowStep", label: "Next Workflow Step" },
      { command: "nss.cancelWorkflow", label: "Cancel Workflow" },
    );
  }

  if (input.hasActiveDiagnostic) {
    actions.push({ command: "nssWorkspaceAi.viewActiveSession", label: "Active Session" });
  }

  return dedupeQuickActions(actions).slice(0, 8);
}

function dedupeQuickActions(actions: readonly NssSidebarQuickAction[]): NssSidebarQuickAction[] {
  const deduped: NssSidebarQuickAction[] = [];
  const seen = new Set<string>();

  for (const action of actions) {
    if (seen.has(action.command)) {
      continue;
    }

    seen.add(action.command);
    deduped.push(action);
  }

  return deduped;
}
