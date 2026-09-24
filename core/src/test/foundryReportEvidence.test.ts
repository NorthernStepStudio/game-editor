import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateFoundryCriterion,
  measureFoundryCriterionFromVerificationReport,
  type FoundryCriterionV2,
  type FoundryVerificationReport,
} from "../foundry/index.js";

const report: FoundryVerificationReport = {
  protocol: "nss.foundry.verification-report.v1",
  executionId: "run-1",
  runtimeSessionId: "runtime-1",
  createdAt: "2026-09-24T19:00:00.000Z",
  completedAt: "2026-09-24T19:00:01.000Z",
  steps: [],
  finalSnapshot: {
    protocol: "nss.foundry.runtime-snapshot.v1",
    runtimeSessionId: "runtime-1",
    capturedAt: "2026-09-24T19:00:01.000Z",
    scenePath: "res://main.tscn",
    ready: true,
    tree: null,
    errors: [],
    logs: [],
    performance: {
      fps: 60,
      frameTimeMs: 16,
      memoryMb: 128,
      objectCount: 20,
    },
    revision: 2,
  },
  incidents: [],
  artifacts: [],
  stateHash:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

function criterion(
  overrides: Partial<FoundryCriterionV2>,
): FoundryCriterionV2 {
  return {
    protocol: "nss.foundry.criterion.v2",
    id: "c1",
    description: "criterion",
    type: "replay_checksum",
    evidenceRequired: true,
    ...overrides,
  };
}

describe("Foundry verification report criterion evidence", () => {
  it("binds the report state hash to replay checksum evidence", () => {
    const spec = criterion({ expected: report.stateHash });
    const evidence = measureFoundryCriterionFromVerificationReport(
      spec,
      report,
      "file:///evidence/verification-report.json",
    );
    assert.equal(evidence.actual, report.stateHash);
    assert.equal(
      evaluateFoundryCriterion(spec, evidence, report.executionId).outcome,
      "passed",
    );
  });

  it("fails when a requested replay checksum does not match", () => {
    const spec = criterion({
      expected:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const evidence = measureFoundryCriterionFromVerificationReport(
      spec,
      report,
      "file:///evidence/verification-report.json",
    );
    assert.equal(
      evaluateFoundryCriterion(spec, evidence, report.executionId).outcome,
      "failed",
    );
  });

  it("reuses final runtime telemetry for performance evidence", () => {
    const spec = criterion({
      type: "performance_budget",
      target: "performance.frameTimeMs",
      expected: 16.67,
    });
    const evidence = measureFoundryCriterionFromVerificationReport(
      spec,
      report,
      "file:///evidence/verification-report.json",
    );
    assert.equal(evidence.actual, 16);
    assert.equal(
      evaluateFoundryCriterion(spec, evidence, report.executionId).outcome,
      "passed",
    );
  });

  it("keeps visual-only criteria unknown without a measured comparison", () => {
    const spec = criterion({
      type: "visual_baseline",
      expected: "baseline-1",
    });
    const evidence = measureFoundryCriterionFromVerificationReport(
      spec,
      report,
      "file:///evidence/verification-report.json",
    );
    assert.equal(evidence.outcome, "unknown");
  });
});
