import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHARACTER_RIGGING_PIPELINE_VERSION,
  STANDARD_YUN_HUMANOID_BONES,
  STANDARD_YUN_HUMANOID_SKELETON,
  BlenderRiggingProvider,
  BlenderSkinWeightProvider,
  BlenderSkeletonEditProvider,
  BlenderAnimationGenerationProvider,
  BlenderRetargetingProvider,
} from "../index.js";

test("Character rigging pipeline: schema version and standard humanoid bones", () => {
  assert.equal(CHARACTER_RIGGING_PIPELINE_VERSION, "1.0.0");
  assert.equal(STANDARD_YUN_HUMANOID_SKELETON.rootBone, "Root");
  assert.ok(STANDARD_YUN_HUMANOID_BONES.length >= 18);
  const boneNames = STANDARD_YUN_HUMANOID_BONES.map((b) => b.name);
  assert.ok(boneNames.includes("Spine"));
  assert.ok(boneNames.includes("Chest"));
  assert.ok(boneNames.includes("Thigh_L"));
  assert.ok(boneNames.includes("Shin_R"));
  assert.ok(boneNames.includes("Foot_L"));
});

test("BlenderRiggingProvider: generates standard skeleton and scales bones", async () => {
  const provider = new BlenderRiggingProvider();
  assert.equal(provider.providerId, "blender-native-rigging");
  assert.ok(provider.supportedTopologies.includes("humanoid"));

  const res = await provider.generateSkeleton({
    characterId: "yun_char_01",
    meshSourceUri: "res://assets/test.glb",
    targetTopology: "humanoid",
    heightScale: 1.2,
  });

  assert.equal(res.success, true);
  assert.equal(res.characterId, "yun_char_01");
  assert.equal(res.skeleton.bones.length, STANDARD_YUN_HUMANOID_BONES.length);
  const headBone = res.skeleton.bones.find((b) => b.name === "Head");
  assert.ok(headBone);
  assert.equal(headBone.head[2], 1.6 * 1.2);

  const ops = provider.compileRiggingOperations(res.outputArmatureName, res.skeleton);
  assert.ok(ops.length > res.skeleton.bones.length);
  assert.equal(ops[0].op, "rig.create_armature");
  assert.ok(ops.some((op) => op.op === "rig.create_bone" && op.name === "Root"));
});

test("BlenderSkinWeightProvider: assigns weights and compiles operations", async () => {
  const provider = new BlenderSkinWeightProvider();
  assert.equal(provider.providerId, "blender-native-skinning");

  const res = await provider.assignWeights({
    characterId: "yun_char_01",
    meshName: "Mesh_Body",
    armatureName: "yun_char_01_Armature",
    algorithm: "automatic_heat",
  });

  assert.equal(res.success, true);
  assert.equal(res.vertexGroupCount, STANDARD_YUN_HUMANOID_BONES.length);

  const ops = provider.compileSkinningOperations("Mesh_Body", "yun_char_01_Armature", "automatic");
  assert.equal(ops.length, 2);
  assert.equal(ops[0].op, "rig.parent_mesh");
  assert.equal(ops[1].op, "rig.assign_weights");
});

test("BlenderSkeletonEditProvider: supports bone renaming, reparenting and adjustment", async () => {
  const provider = new BlenderSkeletonEditProvider();

  const res = await provider.editSkeleton({
    characterId: "yun_char_01",
    armatureName: "yun_char_01_Armature",
    edits: [
      { op: "rename_bone", bone: "Shin_L", newName: "LowerLeg_L" },
      { op: "adjust_bone", bone: "Head", newTail: [0, 0, 2.0] },
    ],
  });

  assert.equal(res.success, true);
  assert.equal(res.appliedEdits, 2);
  const renamed = res.updatedSkeleton.bones.find((b) => b.name === "LowerLeg_L");
  assert.ok(renamed);
  const adjusted = res.updatedSkeleton.bones.find((b) => b.name === "Head");
  assert.ok(adjusted);
  assert.deepEqual(adjusted.tail, [0, 0, 2.0]);
});

test("BlenderAnimationGenerationProvider: produces idle, walk, and run clips", async () => {
  const provider = new BlenderAnimationGenerationProvider();

  for (const type of ["idle", "walk", "run"] as const) {
    const res = await provider.generateClip({
      characterId: "yun_char_01",
      armatureName: "yun_char_01_Armature",
      clipName: type,
      clipType: type,
    });

    assert.equal(res.success, true);
    assert.equal(res.clip.name, type);
    assert.ok(res.clip.keyframes.length > 0);

    const ops = provider.compileAnimationOperations("yun_char_01_Armature", res.clip);
    assert.ok(ops.length >= 1 + res.clip.keyframes.length);
    assert.equal(ops[0].op, "animation.create_action");
    assert.ok(ops.some((op) => op.op === "animation.insert_keyframe"));
  }
});

test("BlenderRetargetingProvider: maps clip bones to target armature", async () => {
  const provider = new BlenderRetargetingProvider();

  const res = await provider.retargetClip({
    characterId: "yun_char_01",
    targetArmatureName: "yun_char_01_Armature",
    sourceClipUri: "res://assets/mocap_run.bvh",
    sourceClipName: "mocap_run",
    boneMapping: [
      { sourceBone: "mixamorig:Hips", targetBone: "Hips" },
      { sourceBone: "mixamorig:Spine", targetBone: "Spine" },
    ],
  });

  assert.equal(res.success, true);
  assert.equal(res.mappedBoneCount, 2);
  assert.equal(res.outputClipName, "mocap_run_retargeted");
});
