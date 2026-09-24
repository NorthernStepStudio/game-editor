import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateFoundryCriterion,
  measureFoundryCriterionFromSnapshot,
  type FoundryCriterionV2,
  type FoundryRuntimeSnapshot,
} from "../foundry/index.js";

const snapshot: FoundryRuntimeSnapshot = {
  protocol: "nss.foundry.runtime-snapshot.v1",
  runtimeSessionId: "runtime-1",
  capturedAt: "2026-09-24T19:00:00.000Z",
  scenePath: "res://main.tscn",
  ready: true,
  tree: {
    path: "/root/Main",
    name: "Main",
    type: "Node2D",
    properties: {},
    children: [
      {
        path: "/root/Main/Player",
        name: "Player",
        type: "CharacterBody2D",
        properties: {
          health: 80,
          motion: { speed: 12 },
          state: "RUN",
        },
        children: [],
      },
    ],
  },
  errors: [],
  logs: [],
  performance: {
    fps: 60,
    frameTimeMs: 16,
    memoryMb: 128,
    objectCount: 40,
  },
  revision: 4,
};

function criterion(
  overrides: Partial<FoundryCriterionV2>,
): FoundryCriterionV2 {
  return {
    protocol: "nss.foundry.criterion.v2",
    id: "c1",
    description: "runtime criterion",
    type: "property_equals",
    expected: 80,
    evidenceRequired: true,
    ...overrides,
  };
}

describe("Foundry runtime criterion evidence", () => {
  it("measures node existence from the semantic tree", () => {
    const spec = criterion({
      type: "node_exists",
      target: "/root/Main/Player",
      expected: true,
    });
    const measured = measureFoundryCriterionFromSnapshot(
      spec,
      snapshot,
      "run-1",
      "file:///evidence/snapshot.json",
    );
    assert.equal(measured.actual, true);
    assert.equal(evaluateFoundryCriterion(spec, measured, "run-1").outcome, "passed");
  });

  it("measures nested node properties without visual inference", () => {
    const spec = criterion({
      target: "/root/Main/Player::motion.speed",
      expected: 12,
    });
    const measured = measureFoundryCriterionFromSnapshot(
      spec,
      snapshot,
      "run-1",
      "file:///evidence/snapshot.json",
    );
    assert.equal(measured.actual, 12);
    assert.equal(evaluateFoundryCriterion(spec, measured, "run-1").outcome, "passed");
  });

  it("measures performance budgets from runtime telemetry", () => {
    const spec = criterion({
      type: "performance_budget",
      target: "performance.frameTimeMs",
      expected: 16.67,
    });
    const measured = measureFoundryCriterionFromSnapshot(
      spec,
      snapshot,
      "run-1",
      "file:///evidence/snapshot.json",
    );
    assert.equal(measured.actual, 16);
    assert.equal(evaluateFoundryCriterion(spec, measured, "run-1").outcome, "passed");
  });

  it("returns unknown for evidence that cannot be derived from a runtime snapshot", () => {
    const spec = criterion({
      type: "visual_baseline",
      expected: "approved-baseline",
    });
    const measured = measureFoundryCriterionFromSnapshot(
      spec,
      snapshot,
      "run-1",
      "file:///evidence/snapshot.json",
    );
    assert.equal(measured.outcome, "unknown");
    assert.equal(evaluateFoundryCriterion(spec, measured, "run-1").outcome, "blocked");
  });
});
