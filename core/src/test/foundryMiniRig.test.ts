import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MiniRigProvider, parseJoints } from "../foundry/assets/providers/miniRig/miniRigProvider.js";
import { MINI_RIG_SCRIPT } from "../foundry/assets/providers/miniRig/rigScript.js";

test("hand-placed joints accept only known joints as [x, z] metres", () => {
  assert.equal(parseJoints(undefined), undefined);
  assert.deepEqual(parseJoints({ "arm-left": [0.13, 0.3], head: [0, 0.345] }), { "arm-left": [0.13, 0.3], head: [0, 0.345] });
  assert.throws(() => parseJoints({ elbow: [0, 0] }), /Unknown joint/);
  assert.throws(() => parseJoints({ head: [0] }), /\[x, z\]/);
  assert.throws(() => parseJoints({ head: [0, Number.NaN] }), /\[x, z\]/);
  assert.throws(() => parseJoints({ head: [0, 1e9] }), /\[x, z\]/);
  assert.throws(() => parseJoints([1, 2]), /joint names/);
});

test("the rigger is local and free, rigs only from a parent model, and only moves joints", async () => {
  const provider = new MiniRigProvider({ referenceSkeleton: "missing.glb", resolveModelFile: () => undefined });
  assert.equal(provider.descriptor.local, true);
  assert.equal(provider.descriptor.externalCost, false);
  assert.deepEqual(provider.descriptor.operations, ["rig"]);
  await assert.rejects(provider.execute({ requestId: "r", assetId: "x", kind: "mesh_3d", operation: "rig" }, { outputRoot: "." }), /Choose the model/);
  await assert.rejects(provider.execute({ requestId: "r", assetId: "x", kind: "mesh_3d", operation: "rig", parentAsset: "y" }, { outputRoot: "." }), /no \.glb model/);
  // Joints are translated, never rotated, so the reference animations stay valid.
  assert.match(MINI_RIG_SCRIPT, /bone\.head \+= delta\s+bone\.tail \+= delta/);
  assert.doesNotMatch(MINI_RIG_SCRIPT, /\.roll\s*=/);
});

test("one-piece models (image-to-3D) are rigged from their shape with soft weights", () => {
  // A single mesh, or parts without arm/head names, switches to shape mode.
  assert.match(MINI_RIG_SCRIPT, /SHAPE_MODE = len\(parts\) == 1 or not \(arm_l or arm_r or head\)/);
  assert.match(MINI_RIG_SCRIPT, /REPORT\["mode"\] = "shape" if SHAPE_MODE else "parts"/);
  // Weights blend smoothly across each joint instead of cutting at it, so the mesh bends without tearing.
  assert.match(MINI_RIG_SCRIPT, /def smooth\(a, b, x\)/);
  assert.match(MINI_RIG_SCRIPT, /w\["torso"\] = max\(0\.0, rest\)/);
  // Named-part models keep the rigid per-part weights.
  assert.match(MINI_RIG_SCRIPT, /for obj in \(\[\] if SHAPE_MODE else parts\):/);
});

test("one-piece joints come from a ray-cast silhouette, robust to sparse vertices, ponytails and long clothes", () => {
  // simplified meshes have few vertices on flat areas, so the shape is read with rays, not vertices
  assert.match(MINI_RIG_SCRIPT, /tree\.ray_cast\(Vector\(\(xc\(c\), lo_all\.y - 1, zb\(b\)\)\)/);
  // a row is as wide as its shorter side, so a one-sided ponytail is never taken for the arms
  assert.match(MINI_RIG_SCRIPT, /a row is as wide as its shorter side/);
  // only what lies within a leg's width below the hips follows that leg
  assert.match(MINI_RIG_SCRIPT, /inside = 1 - smooth\(reach, reach \+ 0\.025/);
});

test("one-piece weights follow what each point is joined to, and a hanging strap never sets the hips", () => {
  // the model is filled into a solid and each body part grows from its core through it
  assert.match(MINI_RIG_SCRIPT, /def voxel_weights\(\):/);
  assert.match(MINI_RIG_SCRIPT, /REPORT\["weighting"\] = "connected" if connected else "position"/);
  // points the body does not reach keep the position rule
  assert.match(MINI_RIG_SCRIPT, /weights = shape_weights\(v\.co\)/);
  // the hips need the centre to be solid over a real width, and never sit at the feet
  assert.match(MINI_RIG_SCRIPT, /central_run\(b\) or 0\.0\) > 0\.025 \* height/);
  assert.match(MINI_RIG_SCRIPT, /if zb\(crotch\) < z0 \+ 0\.1 \* height:/);
});
