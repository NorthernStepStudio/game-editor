/**
 * Build BlenderOperation lists for Yun roster variants from CharacterVariantSpec.
 * Shares 18-bone rig + idle/walk/run with yun_player_base_v2; only silhouette/materials differ.
 */

import { BLENDER_TASK_SCHEMA_VERSION, type BlenderTaskSpec } from "./blenderTaskSpec.js";
import type { BlenderOperation } from "./blenderOperations.js";
import {
  type YunCharacterVariantSpec,
  YUN_ROSTER_TEAM_COLOR_MATERIAL,
  getYunRosterVariant,
} from "./yunCharacterVariantSpec.js";

function z(h: number, base: number): number {
  return base * h;
}

/** Shared locomotion keyframes used by all Matterhorn Yun roster characters. */
export function appendSharedYunLocomotionAnimations(ops: BlenderOperation[]): void {
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
}

export function buildYunCharacterVariantOperations(spec: YunCharacterVariantSpec): BlenderOperation[] {
  const h = spec.heightScale;
  const tw = spec.torsoWidth;
  const td = spec.torsoDepth;
  const lt = spec.limbThickness;
  const hs = spec.headScale;
  const armShirt = spec.jerseyStyle === "sleeved" ? "MAT_TeamShirt" : "MAT_Skin";
  const shoeH = spec.shoeStyle === "high" ? 1.35 : 1.0;

  const meshes: string[] = [
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
  ];

  const ops: BlenderOperation[] = [
    { op: "scene.new", sceneName: `YunVariant_${spec.assetId}` },

    { op: "material.create", name: "MAT_Skin", baseColor: [...spec.skinColor], roughness: 0.52 },
    {
      op: "material.create",
      name: YUN_ROSTER_TEAM_COLOR_MATERIAL,
      baseColor: [...spec.shirtPreviewColor],
      roughness: 0.42,
    },
    { op: "material.create", name: "MAT_Shorts", baseColor: [...spec.shortsColor], roughness: 0.58 },
    { op: "material.create", name: "MAT_Shoes", baseColor: [...spec.shoeColor], roughness: 0.38 },
    { op: "material.create", name: "MAT_Accent", baseColor: [...spec.accentColor], roughness: 0.32 },
    { op: "material.create", name: "MAT_Hair", baseColor: [...spec.hairColor], roughness: 0.7 },
    { op: "material.create", name: "MAT_Eyes", baseColor: [0.08, 0.08, 0.1, 1], roughness: 0.25 },

    {
      op: "mesh.create_primitive",
      name: "Mesh_Head",
      primitive: "uv_sphere",
      radius: 0.155 * hs,
      location: [0, 0.02, z(h, 1.6)],
    },
  ];

  // Hair styles
  if (spec.hairStyle === "cap") {
    ops.push({
      op: "mesh.create_primitive",
      name: "Mesh_Hair",
      primitive: "uv_sphere",
      radius: 0.165 * hs,
      location: [0, -0.01, z(h, 1.64)],
      scale: [1.02, 0.95, 0.72],
    });
  } else if (spec.hairStyle === "buzz") {
    ops.push({
      op: "mesh.create_primitive",
      name: "Mesh_Hair",
      primitive: "uv_sphere",
      radius: 0.158 * hs,
      location: [0, 0.0, z(h, 1.62)],
      scale: [1.0, 0.92, 0.55],
    });
  } else if (spec.hairStyle === "afro") {
    ops.push({
      op: "mesh.create_primitive",
      name: "Mesh_Hair",
      primitive: "uv_sphere",
      radius: 0.22 * hs,
      location: [0, -0.02, z(h, 1.68)],
      scale: [1.05, 1.05, 0.95],
    });
  } else {
    // ponytail: cap + tail
    ops.push({
      op: "mesh.create_primitive",
      name: "Mesh_Hair",
      primitive: "uv_sphere",
      radius: 0.16 * hs,
      location: [0, -0.01, z(h, 1.64)],
      scale: [1.0, 0.9, 0.7],
    });
    ops.push({
      op: "mesh.create_primitive",
      name: "Mesh_HairTail",
      primitive: "uv_sphere",
      radius: 0.07 * hs,
      location: [0, -0.14, z(h, 1.52)],
      scale: [0.7, 1.4, 0.7],
    });
    meshes.push("Mesh_HairTail");
  }

  if (spec.browIndication) {
    ops.push({
      op: "mesh.create_primitive",
      name: "Mesh_Brow",
      primitive: "cube",
      size: 0.12,
      location: [0, 0.12, z(h, 1.64)],
      scale: [1.1, 0.25, 0.2],
    });
    meshes.push("Mesh_Brow");
  }

  ops.push(
    {
      op: "mesh.create_primitive",
      name: "Mesh_Eye_L",
      primitive: "uv_sphere",
      radius: 0.028 * hs,
      location: [0.055 * hs, 0.13, z(h, 1.6)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Eye_R",
      primitive: "uv_sphere",
      radius: 0.028 * hs,
      location: [-0.055 * hs, 0.13, z(h, 1.6)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Neck",
      primitive: "cylinder",
      radius: 0.07 * lt,
      depth: 0.12 * h,
      location: [0, 0.01, z(h, 1.42)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Torso",
      primitive: "cube",
      size: 0.5,
      location: [0, 0.02, z(h, 1.12)],
      scale: [tw, td, 0.9 * h],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Collar",
      primitive: "cylinder",
      radius: spec.jerseyStyle === "tank" ? 0.09 : 0.12,
      depth: spec.jerseyStyle === "tank" ? 0.04 : 0.06,
      location: [0, 0.02, z(h, 1.36)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shoulder_L",
      primitive: "uv_sphere",
      radius: 0.09 * lt,
      location: [0.26 * tw / 0.78, 0.02, z(h, 1.3)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shoulder_R",
      primitive: "uv_sphere",
      radius: 0.09 * lt,
      location: [-0.26 * tw / 0.78, 0.02, z(h, 1.3)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Pelvis",
      primitive: "cube",
      size: 0.44,
      location: [0, 0.02, z(h, 0.74)],
      scale: [tw * 1.05, td * 1.05, 0.48 * h],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_HipJoin_L",
      primitive: "uv_sphere",
      radius: 0.08 * lt,
      location: [0.13 * tw / 0.78, 0.02, z(h, 0.66)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_HipJoin_R",
      primitive: "uv_sphere",
      radius: 0.08 * lt,
      location: [-0.13 * tw / 0.78, 0.02, z(h, 0.66)],
    },
  );

  const armX = 0.36 * (tw / 0.78);
  ops.push(
    {
      op: "mesh.create_primitive",
      name: "Mesh_UpperArm_L",
      primitive: "cylinder",
      radius: 0.058 * lt,
      depth: 0.3 * h,
      location: [armX, 0.04, z(h, 1.14)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Elbow_L",
      primitive: "uv_sphere",
      radius: 0.05 * lt,
      location: [armX + 0.1, 0.05, z(h, 1.0)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_ForeArm_L",
      primitive: "cylinder",
      radius: 0.048 * lt,
      depth: 0.28 * h,
      location: [armX + 0.16, 0.06, z(h, 0.88)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Hand_L",
      primitive: "cube",
      size: 0.11,
      location: [armX + 0.22, 0.08, z(h, 0.72)],
      scale: [0.75 * lt, 0.5, 1.15],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_UpperArm_R",
      primitive: "cylinder",
      radius: 0.058 * lt,
      depth: 0.3 * h,
      location: [-armX, 0.04, z(h, 1.14)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Elbow_R",
      primitive: "uv_sphere",
      radius: 0.05 * lt,
      location: [-armX - 0.1, 0.05, z(h, 1.0)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_ForeArm_R",
      primitive: "cylinder",
      radius: 0.048 * lt,
      depth: 0.28 * h,
      location: [-armX - 0.16, 0.06, z(h, 0.88)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Hand_R",
      primitive: "cube",
      size: 0.11,
      location: [-armX - 0.22, 0.08, z(h, 0.72)],
      scale: [0.75 * lt, 0.5, 1.15],
    },
  );

  const legX = 0.13 * (tw / 0.78);
  ops.push(
    {
      op: "mesh.create_primitive",
      name: "Mesh_Thigh_L",
      primitive: "cylinder",
      radius: 0.075 * lt,
      depth: 0.36 * h,
      location: [legX, 0.02, z(h, 0.5)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Knee_L",
      primitive: "uv_sphere",
      radius: 0.055 * lt,
      location: [legX, 0.02, z(h, 0.34)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shin_L",
      primitive: "cylinder",
      radius: 0.058 * lt,
      depth: 0.34 * h,
      location: [legX, 0.02, z(h, 0.18)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Foot_L",
      primitive: "cube",
      size: 0.2,
      location: [legX, 0.08, 0.045 * shoeH],
      scale: [0.65 * lt, 1.4, 0.38 * shoeH],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Sole_L",
      primitive: "cube",
      size: 0.2,
      location: [legX, 0.08, 0.012],
      scale: [0.7 * lt, 1.45, 0.12],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Thigh_R",
      primitive: "cylinder",
      radius: 0.075 * lt,
      depth: 0.36 * h,
      location: [-legX, 0.02, z(h, 0.5)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Knee_R",
      primitive: "uv_sphere",
      radius: 0.055 * lt,
      location: [-legX, 0.02, z(h, 0.34)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shin_R",
      primitive: "cylinder",
      radius: 0.058 * lt,
      depth: 0.34 * h,
      location: [-legX, 0.02, z(h, 0.18)],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Foot_R",
      primitive: "cube",
      size: 0.2,
      location: [-legX, 0.08, 0.045 * shoeH],
      scale: [0.65 * lt, 1.4, 0.38 * shoeH],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Sole_R",
      primitive: "cube",
      size: 0.2,
      location: [-legX, 0.08, 0.012],
      scale: [0.7 * lt, 1.45, 0.12],
    },
  );

  ops.push(
    { op: "mesh.bevel", target: "Mesh_Torso", width: 0.025, segments: 2 },
    { op: "mesh.bevel", target: "Mesh_Pelvis", width: 0.02, segments: 2 },
    { op: "mesh.bevel", target: "Mesh_Foot_L", width: 0.01, segments: 1 },
    { op: "mesh.bevel", target: "Mesh_Foot_R", width: 0.01, segments: 1 },
  );

  ops.push(
    { op: "material.assign", target: "Mesh_Head", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Hair", material: "MAT_Hair" },
    { op: "material.assign", target: "Mesh_Eye_L", material: "MAT_Eyes" },
    { op: "material.assign", target: "Mesh_Eye_R", material: "MAT_Eyes" },
    { op: "material.assign", target: "Mesh_Neck", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Torso", material: YUN_ROSTER_TEAM_COLOR_MATERIAL },
    { op: "material.assign", target: "Mesh_Collar", material: "MAT_Accent" },
    { op: "material.assign", target: "Mesh_Shoulder_L", material: YUN_ROSTER_TEAM_COLOR_MATERIAL },
    { op: "material.assign", target: "Mesh_Shoulder_R", material: YUN_ROSTER_TEAM_COLOR_MATERIAL },
    { op: "material.assign", target: "Mesh_Pelvis", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_HipJoin_L", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_HipJoin_R", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_UpperArm_L", material: armShirt },
    { op: "material.assign", target: "Mesh_Elbow_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_ForeArm_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Hand_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_UpperArm_R", material: armShirt },
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
  );
  if (meshes.includes("Mesh_HairTail")) {
    ops.push({ op: "material.assign", target: "Mesh_HairTail", material: "MAT_Hair" });
  }
  if (meshes.includes("Mesh_Brow")) {
    ops.push({ op: "material.assign", target: "Mesh_Brow", material: "MAT_Hair" });
  }

  // 18-bone hierarchy scaled by height
  ops.push(
    { op: "rig.create_armature", name: "Armature", location: [0, 0, 0] },
    { op: "rig.create_bone", armature: "Armature", name: "Root", head: [0, 0, 0], tail: [0, 0, z(h, 0.12)] },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Hips",
      parent: "Root",
      head: [0, 0, z(h, 0.58)],
      tail: [0, 0, z(h, 0.78)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Spine",
      parent: "Hips",
      head: [0, 0, z(h, 0.78)],
      tail: [0, 0, z(h, 1.05)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Chest",
      parent: "Spine",
      head: [0, 0, z(h, 1.05)],
      tail: [0, 0, z(h, 1.32)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Neck",
      parent: "Chest",
      head: [0, 0, z(h, 1.32)],
      tail: [0, 0, z(h, 1.46)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Head",
      parent: "Neck",
      head: [0, 0, z(h, 1.46)],
      tail: [0, 0, z(h, 1.72)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "UpperArm_L",
      parent: "Chest",
      head: [0.22 * tw / 0.78, 0.02, z(h, 1.3)],
      tail: [0.4 * tw / 0.78, 0.04, z(h, 1.12)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "ForeArm_L",
      parent: "UpperArm_L",
      head: [0.4 * tw / 0.78, 0.04, z(h, 1.12)],
      tail: [0.54 * tw / 0.78, 0.06, z(h, 0.9)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Hand_L",
      parent: "ForeArm_L",
      head: [0.54 * tw / 0.78, 0.06, z(h, 0.9)],
      tail: [0.62 * tw / 0.78, 0.08, z(h, 0.74)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "UpperArm_R",
      parent: "Chest",
      head: [-0.22 * tw / 0.78, 0.02, z(h, 1.3)],
      tail: [-0.4 * tw / 0.78, 0.04, z(h, 1.12)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "ForeArm_R",
      parent: "UpperArm_R",
      head: [-0.4 * tw / 0.78, 0.04, z(h, 1.12)],
      tail: [-0.54 * tw / 0.78, 0.06, z(h, 0.9)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Hand_R",
      parent: "ForeArm_R",
      head: [-0.54 * tw / 0.78, 0.06, z(h, 0.9)],
      tail: [-0.62 * tw / 0.78, 0.08, z(h, 0.74)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Thigh_L",
      parent: "Hips",
      head: [legX, 0.02, z(h, 0.7)],
      tail: [legX, 0.02, z(h, 0.36)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Shin_L",
      parent: "Thigh_L",
      head: [legX, 0.02, z(h, 0.36)],
      tail: [legX, 0.02, z(h, 0.08)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Foot_L",
      parent: "Shin_L",
      head: [legX, 0.02, z(h, 0.08)],
      tail: [legX, 0.16, z(h, 0.04)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Thigh_R",
      parent: "Hips",
      head: [-legX, 0.02, z(h, 0.7)],
      tail: [-legX, 0.02, z(h, 0.36)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Shin_R",
      parent: "Thigh_R",
      head: [-legX, 0.02, z(h, 0.36)],
      tail: [-legX, 0.02, z(h, 0.08)],
    },
    {
      op: "rig.create_bone",
      armature: "Armature",
      name: "Foot_R",
      parent: "Shin_R",
      head: [-legX, 0.02, z(h, 0.08)],
      tail: [-legX, 0.16, z(h, 0.04)],
    },
  );

  for (const mesh of meshes) {
    ops.push({ op: "rig.parent_mesh", mesh, armature: "Armature" });
    ops.push({ op: "rig.assign_weights", mesh, armature: "Armature" });
  }

  appendSharedYunLocomotionAnimations(ops);

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
      location: [2.4, -3.2, 1.55 * h],
      rotationEulerDeg: [70, 0, 38],
      setActive: true,
    },
    { op: "file.save_blend", outputName: `${spec.assetId}.blend` },
    { op: "render.preview", outputName: `${spec.assetId}-preview.png`, width: 720, height: 720 },
    {
      op: "render.multi_view",
      outputPrefix: spec.assetId,
      views: ["front", "side", "back", "three_quarter"],
      width: 640,
      height: 640,
    },
    { op: "export.character_glb", outputName: `${spec.assetId}.glb` },
    { op: "animation.inspect" },
    { op: "character.inspect" },
  );

  return ops;
}

export function buildYunCharacterVariantTaskSpec(
  spec: YunCharacterVariantSpec,
  workingDirectory: string,
): BlenderTaskSpec {
  return {
    schemaVersion: BLENDER_TASK_SCHEMA_VERSION,
    assetName: spec.assetId,
    operations: buildYunCharacterVariantOperations(spec),
    workingDirectory,
    expectedArtifacts: [
      { kind: "blend", name: `${spec.assetId}.blend`, required: true, minBytes: 1 },
      { kind: "glb", name: `${spec.assetId}.glb`, required: true, minBytes: 1 },
      { kind: "json", name: `${spec.assetId}-report.json`, required: true, minBytes: 1 },
      { kind: "json", name: "blender-report.json", required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-front.png`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-side.png`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-back.png`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-three-quarter.png`, required: true, minBytes: 1 },
      { kind: "png", name: `${spec.assetId}-preview.png`, required: true, minBytes: 1 },
    ],
    acceptanceCriteria: [
      `${spec.assetId}.blend created`,
      "18-bone armature present",
      `${YUN_ROSTER_TEAM_COLOR_MATERIAL} present`,
      "idle, walk, and run animations with keyframes",
      "multi-view renders produced",
      `animated ${spec.assetId}.glb exported`,
    ],
    renderSettings: { width: 640, height: 640 },
    exportSettings: { format: "GLB", exportSkins: true, exportAnimations: true },
    timeoutMs: 420_000,
  };
}

export function resolveYunRosterVariantFromGoal(goal: string, criteria: readonly string[]): YunCharacterVariantSpec | undefined {
  const hay = `${goal} ${criteria.join(" ")}`.toLowerCase();
  for (const id of ["yun_player_04", "yun_player_03", "yun_player_02"] as const) {
    if (hay.includes(id)) {
      return getYunRosterVariant(id);
    }
  }
  if (hay.includes("yun roster") || hay.includes("yun_player_roster")) {
    return getYunRosterVariant("yun_player_02");
  }
  return undefined;
}
