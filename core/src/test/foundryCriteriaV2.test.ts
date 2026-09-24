import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateFoundryCriteria,
  evaluateFoundryCriterion,
  type FoundryCriterionEvidenceV2,
  type FoundryCriterionV2,
} from "../foundry/index.js";

const EXECUTION = "run-42";

function criterion(
  overrides: Partial<FoundryCriterionV2> = {},
): FoundryCriterionV2 {
  return {
    protocol: "nss.foundry.criterion.v2",
    id: "criterion-1",
    description: "FPS remains at or above target",
    type: "visual_similarity",
    expected: 0.9,
    evidenceRequired: true,
    ...overrides,
  };
}

function evidence(
  overrides: Partial<FoundryCriterionEvidenceV2> = {},
): FoundryCriterionEvidenceV2 {
  return {
    criterionId: "criterion-1",
    executionId: EXECUTION,
    outcome: "passed",
    actual: 0.95,
    evidenceUris: ["file:///evidence/result.json#criterion-1"],
    timestamp: "2026-09-24T19:00:00.000Z",
    ...overrides,
  };
}

describe("Foundry Criterion V2 evaluator", () => {
  it("verifies numeric measurements rather than trusting claimed pass", () => {
    const pass = evaluateFoundryCriterion(criterion(), evidence(), EXECUTION);
    assert.equal(pass.outcome, "passed");

    const fail = evaluateFoundryCriterion(
      criterion(),
      evidence({ actual: 0.4 }),
      EXECUTION,
    );
    assert.equal(fail.outcome, "failed");
  });

  it("blocks claimed success without persisted evidence", () => {
    const result = evaluateFoundryCriterion(
      criterion(),
      evidence({ evidenceUris: [] }),
      EXECUTION,
    );
    assert.equal(result.outcome, "blocked");
    assert.match(result.reason, /persisted evidence/i);
  });

  it("blocks evidence from another execution", () => {
    const result = evaluateFoundryCriterion(
      criterion(),
      evidence({ executionId: "another-run" }),
      EXECUTION,
    );
    assert.equal(result.outcome, "blocked");
    assert.match(result.reason, /executionId/i);
  });

  it("supports range and budget checks", () => {
    const range = evaluateFoundryCriterion(
      criterion({
        type: "property_range",
        expected: { min: 2, max: 5 },
      }),
      evidence({ actual: 3 }),
      EXECUTION,
    );
    assert.equal(range.outcome, "passed");

    const frameBudget = evaluateFoundryCriterion(
      criterion({ type: "performance_budget", expected: { max: 16.67 } }),
      evidence({ actual: 20 }),
      EXECUTION,
    );
    assert.equal(frameBudget.outcome, "failed");
  });

  it("blocks duplicate evidence instead of selecting one arbitrarily", () => {
    const result = evaluateFoundryCriteria(
      [criterion()],
      [evidence(), evidence({ actual: 0.1 })],
      EXECUTION,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.results[0].outcome, "blocked");
    assert.match(result.results[0].reason, /Duplicate evidence/i);
  });

  it("fails the suite when any deterministic criterion fails", () => {
    const criteria = [
      criterion(),
      criterion({
        id: "criterion-2",
        type: "memory_budget",
        description: "Memory stays below 256MB",
        expected: 256,
      }),
    ];
    const evidenceItems = [
      evidence(),
      evidence({
        criterionId: "criterion-2",
        actual: 400,
        evidenceUris: ["file:///evidence/perf.json#memory"],
      }),
    ];
    const result = evaluateFoundryCriteria(criteria, evidenceItems, EXECUTION);
    assert.equal(result.status, "failed");
    assert.deepEqual(
      result.results.map((item) => item.outcome),
      ["passed", "failed"],
    );
  });
});
