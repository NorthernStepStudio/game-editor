import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  FORGE_CLEANUP_STAGES,
  forgeCleanupIsComplete,
  getForgeCleanupStages,
  validateForgeAssetCleanupPlan,
  validateForgeEvidenceSequence,
  type NssForgeAssetCleanupPlan,
  type NssForgeStageEvidence,
} from "../studio/assets/forgeAssetPipeline.js";

const plan: NssForgeAssetCleanupPlan = {
  id: "yun-hero-cleanup",
  sourceAssetUri: "asset://yun/hero/high-poly.glb",
  targetName: "yun-hero-game-ready",
  targetTriangleBudget: 18000,
  textureResolution: 2048,
  bakeMaps: ["normal", "ambient-occlusion", "vertex-color"],
  exportFormat: "glb",
  engineTarget: "godot",
};

test("Forge cleanup plan exposes the full reusable production pipeline", () => {
  assert.equal(validateForgeAssetCleanupPlan(plan).valid, true);
  assert.deepEqual(getForgeCleanupStages(plan), [
    "source-mesh",
    "guided-retopology",
    "uv-unwrap-pack",
    "bake-normal",
    "bake-ao",
    "bake-vertex-color",
    "optimize-low-poly",
    "export",
    "engine-import",
    "sentinel-validation",
  ]);
});

test("Forge cleanup plan rejects invalid budgets and texture sizes", () => {
  const invalid = validateForgeAssetCleanupPlan({
    ...plan,
    targetTriangleBudget: 0,
    textureResolution: 1500,
  });

  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /triangle budget/i);
  assert.match(invalid.errors.join(" "), /power of two/i);
});

test("Forge evidence cannot advance past a failed stage", () => {
  const evidence: readonly NssForgeStageEvidence[] = [
    {
      stage: "source-mesh",
      outcome: "passed",
      artifactUris: ["artifact://forge/source.glb"],
      summary: "Source mesh captured.",
    },
    {
      stage: "guided-retopology",
      outcome: "failed",
      artifactUris: [],
      summary: "Triangle target not met.",
    },
    {
      stage: "uv-unwrap-pack",
      outcome: "passed",
      artifactUris: ["artifact://forge/uv.glb"],
      summary: "Should not advance.",
    },
  ];

  const validation = validateForgeEvidenceSequence(evidence);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /cannot advance/i);
  assert.equal(forgeCleanupIsComplete(evidence), false);
});

test("Forge cleanup completes only after ordered Sentinel validation", () => {
  const evidence: readonly NssForgeStageEvidence[] = FORGE_CLEANUP_STAGES.map((stage) => ({
    stage,
    outcome: "passed" as const,
    artifactUris: [`artifact://forge/${stage}`],
    summary: `${stage} passed.`,
  }));

  assert.equal(validateForgeEvidenceSequence(evidence).valid, true);
  assert.equal(forgeCleanupIsComplete(evidence), true);
});
