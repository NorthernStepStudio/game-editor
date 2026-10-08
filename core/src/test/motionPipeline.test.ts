import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  getMotionWorkflowStages,
  validateMotionPlan,
  validateMotionStitchPlan,
  type NssMotionPlan,
} from "../studio/assets/motionPipeline.js";

const plan: NssMotionPlan = {
  id: "yun-hero-attack",
  characterManifestId: "yun-hero",
  actionId: "attack-right",
  startReferenceUri: "asset://yun/hero/idle-right.png",
  keyPoseReferenceUri: "asset://yun/hero/attack-apex-right.png",
  states: [
    { id: "anticipation", description: "Prepare the attack.", required: true },
    { id: "apex", description: "Reach the strongest attack pose.", required: true },
    { id: "recovery", description: "Return toward the idle pose.", required: true },
  ],
  candidateTargetCount: 3,
  loopRequired: false,
};

test("motion plan requires a consistent still and explicit key pose", () => {
  assert.equal(validateMotionPlan(plan).valid, true);

  const invalid = validateMotionPlan({
    ...plan,
    startReferenceUri: "",
    keyPoseReferenceUri: "",
  });

  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /start reference/i);
  assert.match(invalid.errors.join(" "), /key\/apex pose/i);
});

test("motion workflow preserves the public key-pose pipeline order", () => {
  assert.deepEqual(getMotionWorkflowStages(plan), [
    "consistent-still",
    "key-pose",
    "interpolation-candidates",
    "frame-selection",
    "stitch",
    "sentinel-validation",
  ]);
});

test("motion stitch plan rejects invalid selected frame ranges", () => {
  const invalid = validateMotionStitchPlan({
    motionPlanId: plan.id,
    segments: [
      {
        candidateId: "candidate-a",
        sourceUri: "artifact://motion/candidate-a.mp4",
        startFrame: 12,
        endFrame: 8,
      },
    ],
  });

  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /end frames/i);
});

test("motion stitch plan accepts selected ranges from multiple candidates", () => {
  const result = validateMotionStitchPlan({
    motionPlanId: plan.id,
    segments: [
      {
        candidateId: "candidate-a",
        sourceUri: "artifact://motion/candidate-a.mp4",
        startFrame: 0,
        endFrame: 7,
      },
      {
        candidateId: "candidate-b",
        sourceUri: "artifact://motion/candidate-b.mp4",
        startFrame: 8,
        endFrame: 15,
      },
    ],
  });

  assert.equal(result.valid, true);
});
