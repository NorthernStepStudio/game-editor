import { strict as assert } from "node:assert";

import { advanceWorkflowRun, getWorkflowDefinition } from "../../services/workflow/workflowDefinitions.js";
import { startWorkflow } from "../../services/workflow/workflowService.js";

export function runWorkflowSmoke(): void {
  const definition = getWorkflowDefinition("debug-build-failure");
  assert.ok(definition);

  const run = startWorkflow(definition!);
  assert.equal(run.currentStepIndex, 0);

  const nextRun = advanceWorkflowRun(run);
  assert.equal(nextRun.currentStepIndex, 1);
}
