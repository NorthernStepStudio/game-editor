/**
 * Fixture builders: crate and disposable humanoid prototypes composed from
 * bounded BlenderOperation primitives (not hard-coded adapter behavior).
 */

import { BLENDER_TASK_SCHEMA_VERSION, type BlenderTaskSpec } from "./blenderTaskSpec.js";
import type { BlenderOperation } from "./blenderOperations.js";

export function buildCrateOperations(): BlenderOperation[] {
  return [
    { op: "scene.new", sceneName: "CrateScene" },
    {
      op: "material.create",
      name: "MAT_Wood",
      baseColor: [0.45, 0.28, 0.12, 1],
      roughness: 0.65,
    },
    {
      op: "material.create",
      name: "MAT_Metal",
      baseColor: [0.2, 0.22, 0.25, 1],
      metallic: 0.85,
      roughness: 0.35,
    },
    {
      op: "mesh.create_primitive",
      name: "Crate_Body",
      primitive: "cube",
      size: 1.6,
      location: [0, 0, 0.8],
    },
    { op: "material.assign", target: "Crate_Body", material: "MAT_Wood" },
    {
      op: "mesh.create_primitive",
      name: "Crate_Detail",
      primitive: "cube",
      size: 1.65,
      location: [0, 0, 0.8],
      scale: [1.02, 1.02, 0.15],
    },
    { op: "mesh.bevel", target: "Crate_Detail", width: 0.03, segments: 2 },
    { op: "material.assign", target: "Crate_Detail", material: "MAT_Metal" },
    {
      op: "light.create",
      name: "Light_Key",
      type: "SUN",
      location: [4, -4, 6],
      energy: 3.5,
      rotationEulerDeg: [45, 15, 45],
    },
    {
      op: "light.create",
      name: "Light_Fill",
      type: "POINT",
      location: [-3, 3, 2],
      energy: 50,
    },
    {
      op: "camera.create",
      name: "Camera_Main",
      location: [3.2, -3.2, 2.6],
      rotationEulerDeg: [60, 0, 45],
      setActive: true,
    },
    { op: "file.save_blend", outputName: "crate.blend" },
    { op: "render.preview", outputName: "crate-preview.png", width: 800, height: 800 },
    { op: "export.glb", outputName: "crate.glb", applyModifiers: true },
    { op: "scene.inspect" },
  ];
}

export function buildCrateTaskSpec(workingDirectory: string): BlenderTaskSpec {
  return {
    schemaVersion: BLENDER_TASK_SCHEMA_VERSION,
    assetName: "crate",
    operations: buildCrateOperations(),
    workingDirectory,
    expectedArtifacts: [
      { kind: "blend", name: "crate.blend", required: true, minBytes: 1 },
      { kind: "png", name: "crate-preview.png", required: true, minBytes: 1 },
      { kind: "glb", name: "crate.glb", required: true, minBytes: 1 },
      { kind: "json", name: "blender-report.json", required: true, minBytes: 1 },
    ],
    acceptanceCriteria: [
      "crate.blend created",
      "preview PNG rendered",
      "crate.glb exported",
    ],
    renderSettings: { width: 800, height: 800 },
    exportSettings: { format: "GLB", applyModifiers: true },
  };
}

/** Simple low-detail humanoid mannequin for rig/animation pipeline proof. */
export function buildHumanoidPrototypeOperations(): BlenderOperation[] {
  const ops: BlenderOperation[] = [
    { op: "scene.new", sceneName: "HumanoidPrototype" },
    {
      op: "material.create",
      name: "MAT_Skin",
      baseColor: [0.72, 0.55, 0.42, 1],
      roughness: 0.55,
    },
    // Body parts (Y-up-ish standing figure along +Z in Blender)
    { op: "mesh.create_primitive", name: "Body_Torso", primitive: "cube", size: 0.5, location: [0, 0, 1.1], scale: [0.7, 0.4, 1.0] },
    { op: "mesh.create_primitive", name: "Body_Head", primitive: "uv_sphere", radius: 0.18, location: [0, 0, 1.75] },
    { op: "mesh.create_primitive", name: "Body_Pelvis", primitive: "cube", size: 0.4, location: [0, 0, 0.7], scale: [0.8, 0.45, 0.5] },
    { op: "mesh.create_primitive", name: "Body_Leg_L", primitive: "cylinder", radius: 0.08, depth: 0.7, location: [0.12, 0, 0.35] },
    { op: "mesh.create_primitive", name: "Body_Leg_R", primitive: "cylinder", radius: 0.08, depth: 0.7, location: [-0.12, 0, 0.35] },
    { op: "mesh.create_primitive", name: "Body_Arm_L", primitive: "cylinder", radius: 0.06, depth: 0.55, location: [0.4, 0, 1.15] },
    { op: "mesh.create_primitive", name: "Body_Arm_R", primitive: "cylinder", radius: 0.06, depth: 0.55, location: [-0.4, 0, 1.15] },
    { op: "material.assign", target: "Body_Torso", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Head", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Pelvis", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Leg_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Leg_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Arm_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Body_Arm_R", material: "MAT_Skin" },
    { op: "rig.create_armature", name: "Armature", location: [0, 0, 0] },
    { op: "rig.create_bone", armature: "Armature", name: "Root", head: [0, 0, 0], tail: [0, 0, 0.15] },
    { op: "rig.create_bone", armature: "Armature", name: "Hips", parent: "Root", head: [0, 0, 0.55], tail: [0, 0, 0.75] },
    { op: "rig.create_bone", armature: "Armature", name: "Spine", parent: "Hips", head: [0, 0, 0.75], tail: [0, 0, 1.2] },
    { op: "rig.create_bone", armature: "Armature", name: "Chest", parent: "Spine", head: [0, 0, 1.2], tail: [0, 0, 1.45] },
    { op: "rig.create_bone", armature: "Armature", name: "Neck", parent: "Chest", head: [0, 0, 1.45], tail: [0, 0, 1.6] },
    { op: "rig.create_bone", armature: "Armature", name: "Head", parent: "Neck", head: [0, 0, 1.6], tail: [0, 0, 1.85] },
    { op: "rig.create_bone", armature: "Armature", name: "Thigh_L", parent: "Hips", head: [0.12, 0, 0.7], tail: [0.12, 0, 0.35] },
    { op: "rig.create_bone", armature: "Armature", name: "Shin_L", parent: "Thigh_L", head: [0.12, 0, 0.35], tail: [0.12, 0, 0.05] },
    { op: "rig.create_bone", armature: "Armature", name: "Thigh_R", parent: "Hips", head: [-0.12, 0, 0.7], tail: [-0.12, 0, 0.35] },
    { op: "rig.create_bone", armature: "Armature", name: "Shin_R", parent: "Thigh_R", head: [-0.12, 0, 0.35], tail: [-0.12, 0, 0.05] },
    { op: "rig.create_bone", armature: "Armature", name: "UpperArm_L", parent: "Chest", head: [0.22, 0, 1.35], tail: [0.45, 0, 1.15] },
    { op: "rig.create_bone", armature: "Armature", name: "ForeArm_L", parent: "UpperArm_L", head: [0.45, 0, 1.15], tail: [0.6, 0, 0.95] },
    { op: "rig.create_bone", armature: "Armature", name: "UpperArm_R", parent: "Chest", head: [-0.22, 0, 1.35], tail: [-0.45, 0, 1.15] },
    { op: "rig.create_bone", armature: "Armature", name: "ForeArm_R", parent: "UpperArm_R", head: [-0.45, 0, 1.15], tail: [-0.6, 0, 0.95] },
  ];

  // Join body meshes into one skinned mesh for cleaner GLB export.
  // Parent/skin each mesh part onto armature with automatic weights.
  for (const mesh of [
    "Body_Torso",
    "Body_Head",
    "Body_Pelvis",
    "Body_Leg_L",
    "Body_Leg_R",
    "Body_Arm_L",
    "Body_Arm_R",
  ]) {
    ops.push({ op: "rig.parent_mesh", mesh, armature: "Armature" });
    ops.push({ op: "rig.assign_weights", mesh, armature: "Armature" });
  }

  // idle
  ops.push({ op: "animation.create_action", name: "idle", armature: "Armature", frameStart: 1, frameEnd: 24 });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Spine", frame: 1, rotationEulerDeg: [0, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Spine", frame: 12, rotationEulerDeg: [2, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Spine", frame: 24, rotationEulerDeg: [0, 0, 0] });

  // walk
  ops.push({ op: "animation.create_action", name: "walk", armature: "Armature", frameStart: 1, frameEnd: 24 });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Thigh_L", frame: 1, rotationEulerDeg: [25, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Thigh_R", frame: 1, rotationEulerDeg: [-25, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Thigh_L", frame: 12, rotationEulerDeg: [-25, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Thigh_R", frame: 12, rotationEulerDeg: [25, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Thigh_L", frame: 24, rotationEulerDeg: [25, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Thigh_R", frame: 24, rotationEulerDeg: [-25, 0, 0] });

  // run
  ops.push({ op: "animation.create_action", name: "run", armature: "Armature", frameStart: 1, frameEnd: 16 });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Thigh_L", frame: 1, rotationEulerDeg: [40, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Thigh_R", frame: 1, rotationEulerDeg: [-40, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Thigh_L", frame: 8, rotationEulerDeg: [-40, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Thigh_R", frame: 8, rotationEulerDeg: [40, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Thigh_L", frame: 16, rotationEulerDeg: [40, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Thigh_R", frame: 16, rotationEulerDeg: [-40, 0, 0] });

  ops.push(
    { op: "light.create", name: "Light_Key", type: "SUN", location: [4, -4, 6], energy: 3.5, rotationEulerDeg: [45, 15, 45] },
    { op: "camera.create", name: "Camera_Main", location: [2.8, -2.8, 1.8], rotationEulerDeg: [70, 0, 45], setActive: true },
    { op: "file.save_blend", outputName: "humanoid.blend" },
    { op: "render.preview", outputName: "humanoid-preview.png", width: 640, height: 640 },
    { op: "render.multi_view", outputPrefix: "humanoid-view", views: ["front", "side", "three_quarter"], width: 480, height: 480 },
    { op: "export.character_glb", outputName: "humanoid.glb" },
    { op: "animation.inspect" },
    { op: "character.inspect" },
  );

  return ops;
}

export function buildHumanoidPrototypeTaskSpec(workingDirectory: string): BlenderTaskSpec {
  return {
    schemaVersion: BLENDER_TASK_SCHEMA_VERSION,
    assetName: "humanoid",
    operations: buildHumanoidPrototypeOperations(),
    workingDirectory,
    expectedArtifacts: [
      { kind: "blend", name: "humanoid.blend", required: true, minBytes: 1 },
      { kind: "png", name: "humanoid-preview.png", required: true, minBytes: 1 },
      { kind: "png", name: "humanoid-view-front.png", required: true, minBytes: 1 },
      { kind: "png", name: "humanoid-view-side.png", required: true, minBytes: 1 },
      { kind: "png", name: "humanoid-view-three_quarter.png", required: true, minBytes: 1 },
      { kind: "glb", name: "humanoid.glb", required: true, minBytes: 1 },
      { kind: "json", name: "blender-report.json", required: true, minBytes: 1 },
    ],
    acceptanceCriteria: [
      "humanoid.blend created",
      "armature and named bones present",
      "idle, walk, and run animations present",
      "preview renders produced",
      "animated humanoid.glb exported",
    ],
    renderSettings: { width: 640, height: 640 },
    exportSettings: { format: "GLB", exportSkins: true, exportAnimations: true },
    timeoutMs: 300_000,
  };
}
