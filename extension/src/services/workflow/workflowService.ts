import type { NssWorkflowDefinition, NssWorkflowRun } from "../../models/workflow.types.js";

export function startWorkflow(definition: NssWorkflowDefinition): NssWorkflowRun {
  const now = new Date().toISOString();
  return {
    id: `workflow-${Date.now()}`,
    workflowId: definition.id,
    title: definition.title,
    steps: definition.steps,
    currentStepIndex: 0,
    status: "active",
    startedAt: now,
    updatedAt: now,
  };
}

export function cancelWorkflow(run: NssWorkflowRun): NssWorkflowRun {
  return {
    ...run,
    status: "cancelled",
    updatedAt: new Date().toISOString(),
  };
}
