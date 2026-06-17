import type { NssWorkflowRun } from "../models/workflow.types.js";

export function getActiveWorkflowStep(activeWorkflow: NssWorkflowRun | undefined): string | undefined {
  if (!activeWorkflow) {
    return undefined;
  }

  return activeWorkflow.steps[activeWorkflow.currentStepIndex] ?? "Complete";
}
