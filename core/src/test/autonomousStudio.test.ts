import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  STUDIO_WORKFLOW_STAGES,
  createSentinelValidationAssignment,
  deriveStudioWorkflowStage,
  listStudioAgents,
  runSentinelValidation,
  validateStudioAgentRegistry,
} from "../index.js";
import type { NssStudioExecutionResult } from "../studio/types.js";
import type { StudioRun } from "../studio/runTypes.js";

test("logical studio registry keeps orchestration, building, validation, and delivery separate", () => {
  const agents = listStudioAgents();
  assert.equal(validateStudioAgentRegistry().valid, true);
  assert.deepEqual(agents.map(agent => agent.id), [
    "matterhorn", "agent-foundry", "flyrail", "forge", "canvas", "motion", "sentinel", "repo-build",
  ]);
  assert.equal(agents.find(agent => agent.id === "matterhorn")?.kind, "orchestrator");
  assert.equal(agents.find(agent => agent.id === "sentinel")?.kind, "validator");
  assert.equal(agents.find(agent => agent.id === "flyrail")?.canValidateOwnWork, false);
  assert.deepEqual(STUDIO_WORKFLOW_STAGES, ["ask", "plan", "build", "verify", "repair", "complete"]);
});

test("Sentinel independently accepts criterion-specific evidence and rejects missing proof", () => {
  const assignment = createSentinelValidationAssignment("flyrail", ["Player reaches the finish"]);
  assert.equal(assignment.validatorAgentId, "sentinel");

  const valid: NssStudioExecutionResult = {
    taskId: "run-task",
    specialistId: "flyrail",
    status: "completed",
    summary: "done",
    evidence: [{ kind: "report", summary: "criterion", outcome: "passed", uri: "evidence://finish" }],
    criterionResults: [{
      criterion: "Player reaches the finish",
      outcome: "passed",
      evidenceUri: "evidence://finish",
    }],
  };
  const accepted = runSentinelValidation(valid, "run-task", "flyrail", ["Player reaches the finish"]);
  assert.equal(accepted.valid, true);
  assert.equal(accepted.validatorAgentId, "sentinel");
  assert.equal(accepted.builderAgentId, "flyrail");

  const missing = runSentinelValidation(
    { ...valid, evidence: [], criterionResults: [] },
    "run-task",
    "flyrail",
    ["Player reaches the finish"],
  );
  assert.equal(missing.valid, false);
  assert.match(missing.detail, /Missing verified evidence/);
});

test("workflow stage reflects execution, verification, repair and completion", () => {
  const base: StudioRun = {
    id: "r1",
    plan: {
      id: "p1",
      goal: "Build feature",
      createdAt: new Date(0).toISOString(),
      tasks: [{
        id: "t1", title: "Godot work", goal: "Build feature", domain: "godot", specialistId: "flyrail",
        status: "planned", dependsOn: [], acceptanceCriteria: ["Works"],
      }],
      finalAcceptanceCriteria: ["Works"],
    },
    status: "running",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    tasks: [{ id: "t1", executionId: "r1-t1", status: "running" }],
  };
  assert.equal(deriveStudioWorkflowStage(base), "build");
  assert.equal(deriveStudioWorkflowStage({ ...base, status: "validating" }), "verify");
  assert.equal(deriveStudioWorkflowStage({ ...base, status: "blocked", tasks: [{ ...base.tasks[0]!, status: "blocked" }] }), "blocked");
  assert.equal(deriveStudioWorkflowStage({ ...base, status: "completed", tasks: [{ ...base.tasks[0]!, status: "completed" }] }), "complete");
});
