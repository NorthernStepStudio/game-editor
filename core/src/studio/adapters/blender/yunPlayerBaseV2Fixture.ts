/**
 * Yun player base v2 — art/animation refinement of Phase 3H candidate.
 * Keeps 18-bone contract, MAT_TeamShirt team surface, idle/walk/run.
 * Overlapping joint fills reduce primitive gaps; head styling for court readability.
 */

import { BLENDER_TASK_SCHEMA_VERSION, type BlenderTaskSpec } from "./blenderTaskSpec.js";
import type { BlenderOperation } from "./blenderOperations.js";
import {
  YUN_PLAYER_BASE_BONES,
  YUN_PLAYER_BASE_MATERIALS,
  YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL,
} from "./yunPlayerBaseFixture.js";

export const YUN_PLAYER_BASE_V2_ASSET_NAME = "yun_player_base_v2" as const;
export const YUN_PLAYER_BASE_V2_REVISION = "2.0.0" as const;

export {
  YUN_PLAYER_BASE_BONES as YUN_PLAYER_BASE_V2_BONES,
  YUN_PLAYER_BASE_MATERIALS as YUN_PLAYER_BASE_V2_MATERIALS,
  YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL as YUN_PLAYER_BASE_V2_TEAM_COLOR_MATERIAL,
};

export function buildYunPlayerBaseV2Operations(): BlenderOperation[] {
  const meshes = [
    "Mesh_Head",
    "Mesh_Hair",
    "Mesh_Eye_L",
    "Mesh_Eye_R",
    "Mesh_Neck",
    "Mesh_Torso",
    "Mesh_Collar",
    "Mesh_Shoulder_L",
    "Mesh_Shoulder_R",
    "Mesh_Pelvis",
    "Mesh_HipJoin_L",
    "Mesh_HipJoin_R",
    "Mesh_UpperArm_L",
    "Mesh_Elbow_L",
    "Mesh_ForeArm_L",
    "Mesh_Hand_L",
    "Mesh_UpperArm_R",
    "Mesh_Elbow_R",
    "Mesh_ForeArm_R",
    "Mesh_Hand_R",
    "Mesh_Thigh_L",
    "Mesh_Knee_L",
    "Mesh_Shin_L",
    "Mesh_Foot_L",
    "Mesh_Sole_L",
    "Mesh_Thigh_R",
    "Mesh_Knee_R",
    "Mesh_Shin_R",
    "Mesh_Foot_R",
    "Mesh_Sole_R",
  ] as const;

  const ops: BlenderOperation[] = [
    { op: "scene.new", sceneName: "YunPlayerBaseV2" },

    { op: "material.create", name: "MAT_Skin", baseColor: [0.8, 0.58, 0.42, 1], roughness: 0.52 },
    { op: "material.create", name: "MAT_TeamShirt", baseColor: [0.95, 0.72, 0.18, 1], roughness: 0.42 },
    { op: "material.create", name: "MAT_Shorts", baseColor: [0.1, 0.16, 0.3, 1], roughness: 0.58 },
    { op: "material.create", name: "MAT_Shoes", baseColor: [0.94, 0.94, 0.96, 1], roughness: 0.38 },
    { op: "material.create", name: "MAT_Accent", baseColor: [0.12, 0.82, 0.52, 1], roughness: 0.32 },
    { op: "material.create", name: "MAT_Hair", baseColor: [0.12, 0.08, 0.06, 1], roughness: 0.7 },
    { op: "material.create", name: "MAT_Eyes", baseColor: [0.08, 0.08, 0.1, 1], roughness: 0.25 },

    // Head / face / hair — readable at court distance
    { op: "mesh.create_primitive", name: "Mesh_Head", primitive: "uv_sphere", radius: 0.155, location: [0, 0.02, 1.6] },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Hair",
      primitive: "uv_sphere",
      radius: 0.165,
      location: [0, -0.04, 1.65],
      scale: [1.02, 0.95, 0.72],
    },
    { op: "mesh.create_primitive", name: "Mesh_Eye_L", primitive: "uv_sphere", radius: 0.032, location: [0.055, 0.162, 1.60] },
    { op: "mesh.create_primitive", name: "Mesh_Eye_R", primitive: "uv_sphere", radius: 0.032, location: [-0.055, 0.162, 1.60] },
    { op: "mesh.create_primitive", name: "Mesh_Neck", primitive: "cylinder", radius: 0.07, depth: 0.12, location: [0, 0.01, 1.42] },

    // Torso — tapered jersey with overlapping shoulders
    {
      op: "mesh.create_primitive",
      name: "Mesh_Torso",
      primitive: "cube",
      size: 0.5,
      location: [0, 0.02, 1.12],
      scale: [0.78, 0.4, 0.9],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Collar",
      primitive: "cylinder",
      radius: 0.12,
      depth: 0.06,
      location: [0, 0.02, 1.36],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shoulder_L",
      primitive: "uv_sphere",
      radius: 0.09,
      location: [0.26, 0.02, 1.3],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shoulder_R",
      primitive: "uv_sphere",
      radius: 0.09,
      location: [-0.26, 0.02, 1.3],
    },

    // Pelvis / hip joins
    {
      op: "mesh.create_primitive",
      name: "Mesh_Pelvis",
      primitive: "cube",
      size: 0.44,
      location: [0, 0.02, 0.74],
      scale: [0.82, 0.42, 0.48],
    },
    { op: "mesh.create_primitive", name: "Mesh_HipJoin_L", primitive: "uv_sphere", radius: 0.08, location: [0.13, 0.02, 0.66] },
    { op: "mesh.create_primitive", name: "Mesh_HipJoin_R", primitive: "uv_sphere", radius: 0.08, location: [-0.13, 0.02, 0.66] },

    // Arms with elbow fills — slight forward bias (+Y) for athletic stance
    {
      op: "mesh.create_primitive",
      name: "Mesh_UpperArm_L",
      primitive: "cylinder",
      radius: 0.058,
      depth: 0.3,
      location: [0.36, 0.04, 1.14],
    },
    { op: "mesh.create_primitive", name: "Mesh_Elbow_L", primitive: "uv_sphere", radius: 0.05, location: [0.46, 0.05, 1.0] },
    {
      op: "mesh.create_primitive",
      name: "Mesh_ForeArm_L",
      primitive: "cylinder",
      radius: 0.048,
      depth: 0.28,
      location: [0.52, 0.06, 0.88],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Hand_L",
      primitive: "cube",
      size: 0.11,
      location: [0.58, 0.08, 0.72],
      scale: [0.75, 0.5, 1.15],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_UpperArm_R",
      primitive: "cylinder",
      radius: 0.058,
      depth: 0.3,
      location: [-0.36, 0.04, 1.14],
    },
    { op: "mesh.create_primitive", name: "Mesh_Elbow_R", primitive: "uv_sphere", radius: 0.05, location: [-0.46, 0.05, 1.0] },
    {
      op: "mesh.create_primitive",
      name: "Mesh_ForeArm_R",
      primitive: "cylinder",
      radius: 0.048,
      depth: 0.28,
      location: [-0.52, 0.06, 0.88],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Hand_R",
      primitive: "cube",
      size: 0.11,
      location: [-0.58, 0.08, 0.72],
      scale: [0.75, 0.5, 1.15],
    },

    // Legs / knees / shoes
    {
      op: "mesh.create_primitive",
      name: "Mesh_Thigh_L",
      primitive: "cylinder",
      radius: 0.075,
      depth: 0.36,
      location: [0.13, 0.02, 0.5],
    },
    { op: "mesh.create_primitive", name: "Mesh_Knee_L", primitive: "uv_sphere", radius: 0.055, location: [0.13, 0.02, 0.34] },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shin_L",
      primitive: "cylinder",
      radius: 0.058,
      depth: 0.34,
      location: [0.13, 0.02, 0.18],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Foot_L",
      primitive: "cube",
      size: 0.2,
      location: [0.13, 0.08, 0.045],
      scale: [0.65, 1.4, 0.38],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Sole_L",
      primitive: "cube",
      size: 0.2,
      location: [0.13, 0.08, 0.012],
      scale: [0.7, 1.45, 0.12],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Thigh_R",
      primitive: "cylinder",
      radius: 0.075,
      depth: 0.36,
      location: [-0.13, 0.02, 0.5],
    },
    { op: "mesh.create_primitive", name: "Mesh_Knee_R", primitive: "uv_sphere", radius: 0.055, location: [-0.13, 0.02, 0.34] },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shin_R",
      primitive: "cylinder",
      radius: 0.058,
      depth: 0.34,
      location: [-0.13, 0.02, 0.18],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Foot_R",
      primitive: "cube",
      size: 0.2,
      location: [-0.13, 0.08, 0.045],
      scale: [0.65, 1.4, 0.38],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Sole_R",
      primitive: "cube",
      size: 0.2,
      location: [-0.13, 0.08, 0.012],
      scale: [0.7, 1.45, 0.12],
    },

    { op: "mesh.bevel", target: "Mesh_Torso", width: 0.025, segments: 2 },
    { op: "mesh.bevel", target: "Mesh_Pelvis", width: 0.02, segments: 2 },
    { op: "mesh.bevel", target: "Mesh_Foot_L", width: 0.01, segments: 1 },
    { op: "mesh.bevel", target: "Mesh_Foot_R", width: 0.01, segments: 1 },

    // Materials
    { op: "material.assign", target: "Mesh_Head", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Hair", material: "MAT_Hair" },
    { op: "material.assign", target: "Mesh_Eye_L", material: "MAT_Eyes" },
    { op: "material.assign", target: "Mesh_Eye_R", material: "MAT_Eyes" },
    { op: "material.assign", target: "Mesh_Neck", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Torso", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Mesh_Collar", material: "MAT_Accent" },
    { op: "material.assign", target: "Mesh_Shoulder_L", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Mesh_Shoulder_R", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Mesh_Pelvis", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_HipJoin_L", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_HipJoin_R", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_UpperArm_L", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Mesh_Elbow_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_ForeArm_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Hand_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_UpperArm_R", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Mesh_Elbow_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_ForeArm_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Hand_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Thigh_L", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_Knee_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Shin_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Foot_L", material: "MAT_Shoes" },
    { op: "material.assign", target: "Mesh_Sole_L", material: "MAT_Accent" },
    { op: "material.assign", target: "Mesh_Thigh_R", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_Knee_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Shin_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Foot_R", material: "MAT_Shoes" },
    { op: "material.assign", target: "Mesh_Sole_R", material: "MAT_Accent" },

    // Same 18-bone hierarchy as v1
    { op: "rig.create_armature", name: "Armature", location: [0, 0, 0] },
    { op: "rig.create_bone", armature: "Armature", name: "Root", head: [0, 0, 0], tail: [0, 0, 0.12] },
    { op: "rig.create_bone", armature: "Armature", name: "Hips", parent: "Root", head: [0, 0, 0.58], tail: [0, 0, 0.78] },
    { op: "rig.create_bone", armature: "Armature", name: "Spine", parent: "Hips", head: [0, 0, 0.78], tail: [0, 0, 1.05] },
    { op: "rig.create_bone", armature: "Armature", name: "Chest", parent: "Spine", head: [0, 0, 1.05], tail: [0, 0, 1.32] },
    { op: "rig.create_bone", armature: "Armature", name: "Neck", parent: "Chest", head: [0, 0, 1.32], tail: [0, 0, 1.46] },
    { op: "rig.create_bone", armature: "Armature", name: "Head", parent: "Neck", head: [0, 0, 1.46], tail: [0, 0, 1.72] },
    { op: "rig.create_bone", armature: "Armature", name: "UpperArm_L", parent: "Chest", head: [0.22, 0.02, 1.3], tail: [0.4, 0.04, 1.12] },
    { op: "rig.create_bone", armature: "Armature", name: "ForeArm_L", parent: "UpperArm_L", head: [0.4, 0.04, 1.12], tail: [0.54, 0.06, 0.9] },
    { op: "rig.create_bone", armature: "Armature", name: "Hand_L", parent: "ForeArm_L", head: [0.54, 0.06, 0.9], tail: [0.62, 0.08, 0.74] },
    { op: "rig.create_bone", armature: "Armature", name: "UpperArm_R", parent: "Chest", head: [-0.22, 0.02, 1.3], tail: [-0.4, 0.04, 1.12] },
    { op: "rig.create_bone", armature: "Armature", name: "ForeArm_R", parent: "UpperArm_R", head: [-0.4, 0.04, 1.12], tail: [-0.54, 0.06, 0.9] },
    { op: "rig.create_bone", armature: "Armature", name: "Hand_R", parent: "ForeArm_R", head: [-0.54, 0.06, 0.9], tail: [-0.62, 0.08, 0.74] },
    { op: "rig.create_bone", armature: "Armature", name: "Thigh_L", parent: "Hips", head: [0.13, 0.02, 0.7], tail: [0.13, 0.02, 0.36] },
    { op: "rig.create_bone", armature: "Armature", name: "Shin_L", parent: "Thigh_L", head: [0.13, 0.02, 0.36], tail: [0.13, 0.02, 0.08] },
    { op: "rig.create_bone", armature: "Armature", name: "Foot_L", parent: "Shin_L", head: [0.13, 0.02, 0.08], tail: [0.13, 0.16, 0.04] },
    { op: "rig.create_bone", armature: "Armature", name: "Thigh_R", parent: "Hips", head: [-0.13, 0.02, 0.7], tail: [-0.13, 0.02, 0.36] },
    { op: "rig.create_bone", armature: "Armature", name: "Shin_R", parent: "Thigh_R", head: [-0.13, 0.02, 0.36], tail: [-0.13, 0.02, 0.08] },
    { op: "rig.create_bone", armature: "Armature", name: "Foot_R", parent: "Shin_R", head: [-0.13, 0.02, 0.08], tail: [-0.13, 0.16, 0.04] },
  ];

  for (const mesh of meshes) {
    ops.push({ op: "rig.parent_mesh", mesh, armature: "Armature" });
    ops.push({ op: "rig.assign_weights", mesh, armature: "Armature" });
  }

  // Idle — athletic ready stance with subtle weight shift
  ops.push({ op: "animation.create_action", name: "idle", armature: "Armature", frameStart: 1, frameEnd: 60 });
  for (const [frame, spine, chest, hipY, arm] of [
    [1, 2, 1, 0, 12],
    [30, 4, 3, 2, 16],
    [60, 2, 1, 0, 12],
  ] as const) {
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "idle",
      bone: "Hips",
      frame,
      rotationEulerDeg: [0, hipY, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "idle",
      bone: "Spine",
      frame,
      rotationEulerDeg: [spine, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "idle",
      bone: "Chest",
      frame,
      rotationEulerDeg: [chest, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "idle",
      bone: "UpperArm_L",
      frame,
      rotationEulerDeg: [arm, 0, 12],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "idle",
      bone: "UpperArm_R",
      frame,
      rotationEulerDeg: [arm, 0, -12],
    });
  }

  // Walk — opposing limbs + knee bend
  ops.push({ op: "animation.create_action", name: "walk", armature: "Armature", frameStart: 1, frameEnd: 32 });
  for (const [frame, tL, tR, sL, sR, aL, aR] of [
    [1, 30, -30, 12, 8, -22, 22],
    [16, -30, 30, 8, 12, 22, -22],
    [32, 30, -30, 12, 8, -22, 22],
  ] as const) {
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "Thigh_L",
      frame,
      rotationEulerDeg: [tL, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "Thigh_R",
      frame,
      rotationEulerDeg: [tR, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "Shin_L",
      frame,
      rotationEulerDeg: [sL, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "Shin_R",
      frame,
      rotationEulerDeg: [sR, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "UpperArm_L",
      frame,
      rotationEulerDeg: [aL, 0, 8],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "UpperArm_R",
      frame,
      rotationEulerDeg: [aR, 0, -8],
    });
  }

  // Run — larger amplitude, torso lean
  ops.push({ op: "animation.create_action", name: "run", armature: "Armature", frameStart: 1, frameEnd: 20 });
  for (const [frame, tL, tR, sL, sR, aL, aR, chest] of [
    [1, 52, -52, 28, 10, -40, 40, 10],
    [10, -52, 52, 10, 28, 40, -40, 14],
    [20, 52, -52, 28, 10, -40, 40, 10],
  ] as const) {
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "Thigh_L",
      frame,
      rotationEulerDeg: [tL, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "Thigh_R",
      frame,
      rotationEulerDeg: [tR, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "Shin_L",
      frame,
      rotationEulerDeg: [sL, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "Shin_R",
      frame,
      rotationEulerDeg: [sR, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "UpperArm_L",
      frame,
      rotationEulerDeg: [aL, 0, 10],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "UpperArm_R",
      frame,
      rotationEulerDeg: [aR, 0, -10],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "Chest",
      frame,
      rotationEulerDeg: [chest, 0, 0],
    });
  }

  // Sprint — high cadence, aggressive lean
  ops.push({ op: "animation.create_action", name: "sprint", armature: "Armature", frameStart: 1, frameEnd: 16 });
  for (const [frame, tL, tR, sL, sR, aL, aR, chest] of [
    [1, 60, -60, 35, 12, -48, 48, 16],
    [8, -60, 60, 12, 35, 48, -48, 20],
    [16, 60, -60, 35, 12, -48, 48, 16],
  ] as const) {
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "sprint", bone: "Thigh_L", frame, rotationEulerDeg: [tL, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "sprint", bone: "Thigh_R", frame, rotationEulerDeg: [tR, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "sprint", bone: "Shin_L", frame, rotationEulerDeg: [sL, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "sprint", bone: "Shin_R", frame, rotationEulerDeg: [sR, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "sprint", bone: "UpperArm_L", frame, rotationEulerDeg: [aL, 0, 12] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "sprint", bone: "UpperArm_R", frame, rotationEulerDeg: [aR, 0, -12] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "sprint", bone: "Chest", frame, rotationEulerDeg: [chest, 0, 0] });
  }

  // Turn — yaw rotation on Root and Hips
  ops.push({ op: "animation.create_action", name: "turn", armature: "Armature", frameStart: 1, frameEnd: 16 });
  for (const [frame, rootYaw, hipYaw] of [
    [1, 0, 0],
    [8, 15, 5],
    [16, 30, 0],
  ] as const) {
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "turn", bone: "Root", frame, rotationEulerDeg: [0, 0, rootYaw] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "turn", bone: "Hips", frame, rotationEulerDeg: [0, hipYaw, 0] });
  }

  // Celebration — arms up, spine back arch
  ops.push({ op: "animation.create_action", name: "celebration", armature: "Armature", frameStart: 1, frameEnd: 24 });
  for (const [frame, armL, armR, spine] of [
    [1, 10, -10, 0],
    [12, -150, 150, -12],
    [24, 10, -10, 0],
  ] as const) {
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "celebration", bone: "UpperArm_L", frame, rotationEulerDeg: [0, 0, armL] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "celebration", bone: "UpperArm_R", frame, rotationEulerDeg: [0, 0, armR] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "celebration", bone: "Spine", frame, rotationEulerDeg: [spine, 0, 0] });
  }

  ops.push(
    {
      op: "light.create",
      name: "Light_Key",
      type: "SUN",
      location: [4, -4, 6],
      energy: 4.0,
      rotationEulerDeg: [45, 12, 40],
    },
    {
      op: "light.create",
      name: "Light_Fill",
      type: "POINT",
      location: [-2.2, 2.8, 2.0],
      energy: 45,
    },
    {
      op: "camera.create",
      name: "Camera_Main",
      location: [2.4, -3.2, 1.55],
      rotationEulerDeg: [70, 0, 38],
      setActive: true,
    },
    { op: "file.save_blend", outputName: "yun_player_base_v2.blend" },
    { op: "render.preview", outputName: "yun_player_base_v2-preview.png", width: 720, height: 720 },
    {
      op: "render.multi_view",
      outputPrefix: "yun_player_base_v2",
      views: ["front", "side", "back", "three_quarter"],
      width: 640,
      height: 640,
    },
    // Motion pose evidence: set run mid-frame pose via last keyframes already in actions;
    // extra preview after inspecting character.
    { op: "export.character_glb", outputName: "yun_player_base_v2.glb" },
    { op: "animation.inspect" },
    { op: "character.inspect" },
  );

  return ops;
}

export function buildYunPlayerBaseV2TaskSpec(workingDirectory: string): BlenderTaskSpec {
  return {
    schemaVersion: BLENDER_TASK_SCHEMA_VERSION,
    assetName: YUN_PLAYER_BASE_V2_ASSET_NAME,
    operations: buildYunPlayerBaseV2Operations(),
    workingDirectory,
    expectedArtifacts: [
      { kind: "blend", name: "yun_player_base_v2.blend", required: true, minBytes: 1 },
      { kind: "glb", name: "yun_player_base_v2.glb", required: true, minBytes: 1 },
      { kind: "json", name: "yun_player_base_v2-report.json", required: true, minBytes: 1 },
      { kind: "json", name: "blender-report.json", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base_v2-front.png", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base_v2-side.png", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base_v2-back.png", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base_v2-three-quarter.png", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base_v2-preview.png", required: true, minBytes: 1 },
    ],
    acceptanceCriteria: [
      "yun_player_base_v2.blend created",
      "18-bone armature present",
      "MAT_TeamShirt and MAT_Accent materials present",
      "idle, walk, and run animations with keyframes",
      "multi-view renders produced",
      "animated yun_player_base_v2.glb exported",
    ],
    renderSettings: { width: 640, height: 640 },
    exportSettings: { format: "GLB", exportSkins: true, exportAnimations: true },
    timeoutMs: 420_000,
  };
}
