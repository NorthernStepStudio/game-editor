import type { NssWorkflowDefinition, NssWorkflowRun } from "../../models/workflow.types.js";

export const WORKFLOW_DEFINITIONS: readonly NssWorkflowDefinition[] = [
  {
    id: "debug-build-failure",
    title: "Debug Build Failure",
    description: "Triage a failed build or typecheck run and work toward a fix.",
    steps: ["Run task", "Explain failure", "Find likely error files", "Propose or apply fix"],
  },
  {
    id: "plan-feature-change",
    title: "Plan Feature Change",
    description: "Inspect impacted files and produce a human-readable change plan.",
    steps: ["Explain project structure", "Find related files", "Plan change", "Propose edits"],
  },
  {
    id: "analyze-current-file",
    title: "Analyze Current File",
    description: "Understand an active file before editing it.",
    steps: ["Explain file", "Ask about current file", "Generate from selection", "Propose edit"],
  },
  {
    id: "generate-launch-copy",
    title: "Generate Launch Copy",
    description: "Use workspace docs and current mode to draft messaging safely.",
    steps: ["Rebuild knowledge packs", "Show workspace briefing", "Search knowledge", "Ask workspace AI"],
  },
];

export function getWorkflowDefinition(workflowId: string): NssWorkflowDefinition | undefined {
  return WORKFLOW_DEFINITIONS.find((workflow) => workflow.id === workflowId);
}

export function advanceWorkflowRun(workflow: NssWorkflowRun): NssWorkflowRun {
  if (workflow.currentStepIndex >= workflow.steps.length - 1) {
    return {
      ...workflow,
      status: "completed",
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ...workflow,
    currentStepIndex: workflow.currentStepIndex + 1,
    updatedAt: new Date().toISOString(),
  };
}
