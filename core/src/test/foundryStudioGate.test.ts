import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateStudioEvidence } from "../studio/evidenceValidator.js";
import type { NssStudioExecutionResult } from "../studio/types.js";

function structuredCriterion(expected = 0.9): string {
  return JSON.stringify({
    protocol: "nss.foundry.criterion.v2",
    id: "visual-1",
    description: "Visual similarity stays above threshold",
    type: "visual_similarity",
    expected,
    evidenceRequired: true,
  });
}

function execution(actual: number): NssStudioExecutionResult {
  const uri = "file:///evidence/visual.json#visual-1";
  return {
    taskId: "run-task",
    specialistId: "flyrail",
    status: "completed",
    summary: "Provider completed.",
    evidence: [
      {
        kind: "report",
        summary: "visual proof",
        outcome: "passed",
        uri,
      },
    ],
    criterionResults: [
      {
        criterionId: "visual-1",
        description: "Visual similarity stays above threshold",
        checkType: "generic",
        expected: 0.9,
        actual,
        outcome: "passed",
        evidenceUri: uri,
        executionId: "run-task",
      },
    ],
  };
}

describe("Foundry Studio completion gate", () => {
  it("allows completion when typed evidence satisfies the structured criterion", () => {
    const result = validateStudioEvidence(
      execution(0.96),
      "run-task",
      "flyrail",
      [structuredCriterion()],
    );
    assert.equal(result.valid, true);
    assert.equal(result.failed, false);
  });

  it("overrides a provider claimed pass when the measured value fails", () => {
    const result = validateStudioEvidence(
      execution(0.2),
      "run-task",
      "flyrail",
      [structuredCriterion()],
    );
    assert.equal(result.valid, false);
    assert.equal(result.failed, true);
    assert.match(result.detail, /Foundry acceptance failed/i);
  });

  it("blocks completion when structured evidence is missing", () => {
    const raw = execution(0.96);
    const result = validateStudioEvidence(
      { ...raw, criterionResults: [] },
      "run-task",
      "flyrail",
      [structuredCriterion()],
    );
    assert.equal(result.valid, false);
    assert.equal(result.failed, false);
    assert.match(result.detail, /Missing verified evidence/i);
  });
});
