import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  recommendedReusePolicy,
  requiresFoundryApproval,
  validateFoundryOperationPolicy,
  validateFoundryStudioSpec,
  validateLicenseRecord,
  type FoundryStudioSpec,
} from "../foundry/index.js";

function validSpec(): FoundryStudioSpec {
  return {
    protocol: "nss.foundry.studio-spec.v1",
    id: "farm-rpg",
    title: "Farm RPG",
    goal: "Create a coherent playable farming scene.",
    kind: "game",
    createdAt: "2026-09-24T00:00:00.000Z",
    artBible: {
      id: "farm-art",
      style: "pixel-art",
      logicalResolution: { width: 320, height: 180 },
      pixelScale: 4,
      palette: ["#101820", "#f2aa4c"],
      cameraRules: "Integer pixel camera motion.",
    },
    scenes: [
      {
        id: "garden",
        title: "Garden",
        goal: "Player waters a plant.",
        artBibleId: "farm-art",
        actors: [{ id: "player", role: "player", requiredStates: ["walk", "pour"] }],
        interactions: [
          { id: "water", actorId: "player", targetId: "plant", trigger: "use", result: "plant becomes wet" },
        ],
        animationFlow: ["WALK", "LIFT", "POUR", "SETTLE"],
        acceptanceCriteria: ["Player completes watering animation."],
      },
    ],
    performanceBudget: { targetFps: 60, maxFrameTimeMs: 16.67 },
    finalAcceptanceCriteria: ["Scene is playable."],
  };
}

describe("Foundry Foundation", () => {
  it("accepts a valid StudioSpec and preserves non-fatal authoring warnings", () => {
    const validation = validateFoundryStudioSpec(validSpec());
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
    assert.equal(validation.warnings.length, 0);
  });

  it("fails duplicate scene ids and invalid pixel scale", () => {
    const base = validSpec();
    const broken: FoundryStudioSpec = {
      ...base,
      artBible: { ...base.artBible, pixelScale: 0 },
      scenes: [...base.scenes, { ...base.scenes[0] }],
    };
    const validation = validateFoundryStudioSpec(broken);
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join(" "), /pixelScale/i);
    assert.match(validation.errors.join(" "), /Duplicate scene id/i);
  });

  it("warns when an interaction references an undeclared actor", () => {
    const base = validSpec();
    const spec: FoundryStudioSpec = {
      ...base,
      scenes: [
        {
          ...base.scenes[0],
          interactions: [
            { id: "npc-talk", actorId: "missing-npc", trigger: "talk", result: "dialogue opens" },
          ],
        },
      ],
    };
    const validation = validateFoundryStudioSpec(spec);
    assert.equal(validation.valid, true);
    assert.match(validation.warnings.join(" "), /missing-npc/i);
  });

  it("defaults permissive sources to direct reuse and copyleft to adapter-only", () => {
    assert.equal(recommendedReusePolicy("permissive"), "direct");
    assert.equal(recommendedReusePolicy("copyleft"), "adapter-only");
    assert.equal(recommendedReusePolicy("unlicensed"), "reference-only");
  });

  it("rejects direct reuse of unlicensed code", () => {
    const errors = validateLicenseRecord({
      name: "No license",
      classification: "unlicensed",
      reusePolicy: "direct",
    });
    assert.ok(errors.length > 0);
  });

  it("requires approval and a budget for paid external operations", () => {
    const missingBudget = {
      classes: ["external_cost"] as const,
      dryRunSupported: true,
      requiresApproval: false,
    };
    assert.equal(requiresFoundryApproval(missingBudget), true);
    assert.match(validateFoundryOperationPolicy(missingBudget).join(" "), /budget/i);

    const validPolicy = {
      classes: ["external_cost", "network"] as const,
      dryRunSupported: true,
      requiresApproval: false,
      costBudget: { currency: "USD", maxAmount: 5 },
    };
    assert.equal(validateFoundryOperationPolicy(validPolicy).length, 0);
  });
});
