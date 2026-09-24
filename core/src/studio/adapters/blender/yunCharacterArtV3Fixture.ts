/**
 * Yun character art V3.
 *
 * Replaces the visible "stacked primitives" mannequin construction with:
 * - tapered torso/pelvis volumes
 * - tapered limbs aligned between actual joints
 * - no elbow/knee ball fillers
 * - one joined deformable mesh with a single automatic-weight pass
 * - smaller facial features and more intentional hair silhouettes
 * - denser locomotion key poses
 *
 * V3 candidates are generated beside production assets. They are NOT production
 * defaults until gameplay-camera art review and live Godot validation pass.
 */

import { BLENDER_TASK_SCHEMA_VERSION, type BlenderTaskSpec } from "./blenderTaskSpec.js";
import type { BlenderOperation, BlenderVec3 } from "./blenderOperations.js";
import {
  YUN_ROSTER_TEAM_COLOR_MATERIAL,
  type YunCharacterVariantSpec,
  getYunRosterVariant,
} from "./yunCharacterVariantSpec.js";

export const YUN_CHARACTER_ART_V3_REVISION = "3.0.0" as const;

export const YUN_CHARACTER_ART_V3_QUALITY = {
  maxVertices: 9000,
  maxPolygons: 9000,
  maxMeshObjectsAfterJoin: 2,
  expectedBoneCount: 18,
  requiredAnimations: ["idle", "walk", "run"] as const,
} as const;

function z(h: number, value: number): number {
  return h * value;
}

function materialOps(spec: YunCharacterVariantSpec): BlenderOperation[] {
  return [
    { op: "material.create", name: "MAT_Skin", baseColor: [...spec.skinColor], roughness: 0.58 },
    { op: "material.create", name: YUN_ROSTER_TEAM_COLOR_MATERIAL, baseColor: [...spec.shirtPreviewColor], roughness: 0.48 },
    { op: "material.create", name: "MAT_Shorts", baseColor: [...spec.shortsColor], roughness: 0.62 },
    { op: "material.create", name: "MAT_Shoes", baseColor: [...spec.shoeColor], roughness: 0.45 },
    { op: "material.create", name: "MAT_Accent", baseColor: [...spec.accentColor], roughness: 0.38 },
    { op: "material.create", name: "MAT_Hair", baseColor: [...spec.hairColor], roughness: 0.78 },
    { op: "material.create", name: "MAT_Eyes", baseColor: [0.035, 0.035, 0.045, 1], roughness: 0.35 },
  ];
}

function addHair(
  ops: BlenderOperation[],
  meshes: string[],
  spec: YunCharacterVariantSpec,
  h: number,
  hs: number,
): void {
  const add = (op: BlenderOperation, material = "MAT_Hair") => {
    ops.push(op);
    if ("name" in op && typeof op.name === "string") {
      meshes.push(op.name);
      ops.push({ op: "material.assign", target: op.name, material });
    }
  };

  if (spec.hairStyle === "buzz") {
    add({
      op: "mesh.create_primitive",
      name: "Mesh_Hair",
      primitive: "uv_sphere",
      radius: 0.145 * hs,
      location: [0, -0.006, z(h, 1.635)],
      scale: [0.95, 0.9, 0.42],
    });
    return;
  }

  if (spec.hairStyle === "cap") {
    add({
      op: "mesh.create_primitive",
      name: "Mesh_Hair",
      primitive: "uv_sphere",
      radius: 0.15 * hs,
      location: [0, -0.012, z(h, 1.65)],
      scale: [1.0, 0.9, 0.52],
    });
    add({
      op: "mesh.create_tapered_box",
      name: "Mesh_CapBrim",
      location: [0, 0.135, z(h, 1.65)],
      height: 0.025,
      topSize: [0.17 * hs, 0.10],
      bottomSize: [0.19 * hs, 0.12],
      rotationEulerDeg: [0, 0, 0],
    });
    return;
  }

  if (spec.hairStyle === "ponytail") {
    add({
      op: "mesh.create_primitive",
      name: "Mesh_Hair",
      primitive: "uv_sphere",
      radius: 0.15 * hs,
      location: [0, -0.015, z(h, 1.65)],
      scale: [1.0, 0.92, 0.55],
    });
    add({
      op: "mesh.create_tapered_segment",
      name: "Mesh_HairTail",
      start: [0, -0.11, z(h, 1.61)],
      end: [0, -0.19, z(h, 1.45)],
      radiusStart: 0.052 * hs,
      radiusEnd: 0.028 * hs,
      sides: 8,
    });
    return;
  }

  // Afro: several smaller clumps produce a readable silhouette without one giant sphere.
  const clumps: readonly BlenderVec3[] = [
    [0, -0.018, z(h, 1.69)],
    [0.09 * hs, -0.015, z(h, 1.67)],
    [-0.09 * hs, -0.015, z(h, 1.67)],
    [0.055 * hs, -0.065, z(h, 1.72)],
    [-0.055 * hs, -0.065, z(h, 1.72)],
    [0, -0.09, z(h, 1.66)],
  ];
  clumps.forEach((location, index) => {
    add({
      op: "mesh.create_primitive",
      name: index === 0 ? "Mesh_Hair" : `Mesh_HairClump_${index}`,
      primitive: "uv_sphere",
      radius: (index === 0 ? 0.115 : 0.09) * hs,
      location,
      scale: [1.0, 0.95, 0.9],
    });
  });
}

function appendV3Locomotion(ops: BlenderOperation[]): void {
  ops.push({ op: "animation.create_action", name: "idle", armature: "Armature", frameStart: 1, frameEnd: 60 });
  for (const [frame, hipZ, hipYaw, chestX, armL, armR] of [
    [1, 0, -1, 3, 10, 10],
    [20, 0.008, 1, 4, 13, 13],
    [40, -0.004, -1, 3, 11, 11],
    [60, 0, -1, 3, 10, 10],
  ] as const) {
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Hips", frame, location: [0, 0, hipZ], rotationEulerDeg: [0, hipYaw, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Chest", frame, rotationEulerDeg: [chestX, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "UpperArm_L", frame, rotationEulerDeg: [armL, 0, 9] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "UpperArm_R", frame, rotationEulerDeg: [armR, 0, -9] });
  }

  ops.push({ op: "animation.create_action", name: "walk", armature: "Armature", frameStart: 1, frameEnd: 32 });
  for (const [frame, hipZ, leftThigh, rightThigh, leftShin, rightShin, leftArm, rightArm, footL, footR] of [
    [1, 0.01, 28, -28, 8, 18, -24, 24, -6, 8],
    [8, -0.008, 5, -5, 24, 10, -8, 8, 4, -2],
    [16, 0.01, -28, 28, 18, 8, 24, -24, 8, -6],
    [24, -0.008, -5, 5, 10, 24, 8, -8, -2, 4],
    [32, 0.01, 28, -28, 8, 18, -24, 24, -6, 8],
  ] as const) {
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Hips", frame, location: [0, 0, hipZ], rotationEulerDeg: [0, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Thigh_L", frame, rotationEulerDeg: [leftThigh, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Thigh_R", frame, rotationEulerDeg: [rightThigh, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Shin_L", frame, rotationEulerDeg: [leftShin, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Shin_R", frame, rotationEulerDeg: [rightShin, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "UpperArm_L", frame, rotationEulerDeg: [leftArm, 0, 7] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "UpperArm_R", frame, rotationEulerDeg: [rightArm, 0, -7] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Foot_L", frame, rotationEulerDeg: [footL, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "walk", bone: "Foot_R", frame, rotationEulerDeg: [footR, 0, 0] });
  }

  ops.push({ op: "animation.create_action", name: "run", armature: "Armature", frameStart: 1, frameEnd: 20 });
  for (const [frame, hipZ, leftThigh, rightThigh, leftShin, rightShin, leftArm, rightArm, chest, footL, footR] of [
    [1, 0.018, 48, -48, 20, 36, -38, 38, 9, -10, 12],
    [5, 0.035, 12, -12, 46, 22, -15, 15, 12, 6, 0],
    [10, 0.018, -48, 48, 36, 20, 38, -38, 9, 12, -10],
    [15, 0.035, -12, 12, 22, 46, 15, -15, 12, 0, 6],
    [20, 0.018, 48, -48, 20, 36, -38, 38, 9, -10, 12],
  ] as const) {
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Hips", frame, location: [0, 0, hipZ], rotationEulerDeg: [0, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Thigh_L", frame, rotationEulerDeg: [leftThigh, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Thigh_R", frame, rotationEulerDeg: [rightThigh, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Shin_L", frame, rotationEulerDeg: [leftShin, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Shin_R", frame, rotationEulerDeg: [rightShin, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "UpperArm_L", frame, rotationEulerDeg: [leftArm, 0, 8] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "UpperArm_R", frame, rotationEulerDeg: [rightArm, 0, -8] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Chest", frame, rotationEulerDeg: [chest, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Foot_L", frame, rotationEulerDeg: [footL, 0, 0] });
    ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "run", bone: "Foot_R", frame, rotationEulerDeg: [footR, 0, 0] });
  }
}

export function buildYunCharacterArtV3Operations(spec: YunCharacterVariantSpec): BlenderOperation[] {
  const h = spec.heightScale;
  const body = spec.torsoWidth / 0.78;
  const depth = spec.torsoDepth / 0.4;
  const lt = spec.limbThickness;
  const hs = Math.min(spec.headScale, 1.05);
  const prefix = `${spec.assetId}_v3`;

  const shoulderX = 0.24 * body;
  const elbowX = 0.34 * body;
  const wristX = 0.39 * body;
  const legX = 0.12 * body;

  const shoulderL: BlenderVec3 = [shoulderX, 0.015, z(h, 1.28)];
  const elbowL: BlenderVec3 = [elbowX, 0.035, z(h, 1.08)];
  const wristL: BlenderVec3 = [wristX, 0.06, z(h, 0.89)];
  const shoulderR: BlenderVec3 = [-shoulderX, 0.015, z(h, 1.28)];
  const elbowR: BlenderVec3 = [-elbowX, 0.035, z(h, 1.08)];
  const wristR: BlenderVec3 = [-wristX, 0.06, z(h, 0.89)];
  const hipL: BlenderVec3 = [legX, 0.01, z(h, 0.66)];
  const kneeL: BlenderVec3 = [legX * 1.03, 0.025, z(h, 0.37)];
  const ankleL: BlenderVec3 = [legX, 0.07, z(h, 0.095)];
  const hipR: BlenderVec3 = [-legX, 0.01, z(h, 0.66)];
  const kneeR: BlenderVec3 = [-legX * 1.03, 0.025, z(h, 0.37)];
  const ankleR: BlenderVec3 = [-legX, 0.07, z(h, 0.095)];

  const meshes: string[] = [];
  const ops: BlenderOperation[] = [
    { op: "scene.new", sceneName: `YunCharacterArtV3_${spec.displayName}` },
    ...materialOps(spec),
  ];

  const add = (op: BlenderOperation, material: string) => {
    ops.push(op);
    if ("name" in op && typeof op.name === "string") {
      meshes.push(op.name);
      ops.push({ op: "material.assign", target: op.name, material });
    }
  };

  // Head: slightly smaller/longer than V2 and without giant eye spheres.
  add({
    op: "mesh.create_primitive",
    name: "Mesh_Head",
    primitive: "uv_sphere",
    radius: 0.142 * hs,
    location: [0, 0.012, z(h, 1.59)],
    scale: [0.92, 0.86, 1.07],
  }, "MAT_Skin");

  add({
    op: "mesh.create_tapered_segment",
    name: "Mesh_Neck",
    start: [0, 0.006, z(h, 1.34)],
    end: [0, 0.006, z(h, 1.47)],
    radiusStart: 0.073 * lt,
    radiusEnd: 0.064 * lt,
    sides: 10,
  }, "MAT_Skin");

  // Torso and shorts have an actual shoulder/waist/hip silhouette.
  add({
    op: "mesh.create_tapered_box",
    name: "Mesh_Torso",
    location: [0, 0.012, z(h, 1.105)],
    height: z(h, 0.43),
    topSize: [0.49 * body, 0.235 * depth],
    bottomSize: [0.34 * body, 0.205 * depth],
  }, YUN_ROSTER_TEAM_COLOR_MATERIAL);

  add({
    op: "mesh.create_tapered_box",
    name: "Mesh_Pelvis",
    location: [0, 0.012, z(h, 0.755)],
    height: z(h, 0.27),
    topSize: [0.34 * body, 0.21 * depth],
    bottomSize: [0.29 * body, 0.20 * depth],
  }, "MAT_Shorts");

  // Arms follow the actual shoulder→elbow→wrist vectors instead of vertical cylinders.
  const sleeved = spec.jerseyStyle === "sleeved";
  const sleevePointL: BlenderVec3 = [
    shoulderL[0] + (elbowL[0] - shoulderL[0]) * 0.34,
    shoulderL[1] + (elbowL[1] - shoulderL[1]) * 0.34,
    shoulderL[2] + (elbowL[2] - shoulderL[2]) * 0.34,
  ];
  const sleevePointR: BlenderVec3 = [-sleevePointL[0], sleevePointL[1], sleevePointL[2]];

  if (sleeved) {
    add({ op: "mesh.create_tapered_segment", name: "Mesh_Sleeve_L", start: shoulderL, end: sleevePointL, radiusStart: 0.071 * lt, radiusEnd: 0.061 * lt, sides: 10 }, YUN_ROSTER_TEAM_COLOR_MATERIAL);
    add({ op: "mesh.create_tapered_segment", name: "Mesh_UpperArm_L", start: sleevePointL, end: elbowL, radiusStart: 0.057 * lt, radiusEnd: 0.050 * lt, sides: 10 }, "MAT_Skin");
    add({ op: "mesh.create_tapered_segment", name: "Mesh_Sleeve_R", start: shoulderR, end: sleevePointR, radiusStart: 0.071 * lt, radiusEnd: 0.061 * lt, sides: 10 }, YUN_ROSTER_TEAM_COLOR_MATERIAL);
    add({ op: "mesh.create_tapered_segment", name: "Mesh_UpperArm_R", start: sleevePointR, end: elbowR, radiusStart: 0.057 * lt, radiusEnd: 0.050 * lt, sides: 10 }, "MAT_Skin");
  } else {
    add({ op: "mesh.create_tapered_segment", name: "Mesh_UpperArm_L", start: shoulderL, end: elbowL, radiusStart: 0.064 * lt, radiusEnd: 0.050 * lt, sides: 10 }, "MAT_Skin");
    add({ op: "mesh.create_tapered_segment", name: "Mesh_UpperArm_R", start: shoulderR, end: elbowR, radiusStart: 0.064 * lt, radiusEnd: 0.050 * lt, sides: 10 }, "MAT_Skin");
  }
  add({ op: "mesh.create_tapered_segment", name: "Mesh_ForeArm_L", start: elbowL, end: wristL, radiusStart: 0.050 * lt, radiusEnd: 0.037 * lt, sides: 10 }, "MAT_Skin");
  add({ op: "mesh.create_tapered_segment", name: "Mesh_ForeArm_R", start: elbowR, end: wristR, radiusStart: 0.050 * lt, radiusEnd: 0.037 * lt, sides: 10 }, "MAT_Skin");

  add({ op: "mesh.create_primitive", name: "Mesh_Hand_L", primitive: "uv_sphere", radius: 0.055 * lt, location: [wristL[0] + 0.012, wristL[1] + 0.025, wristL[2] - z(h, 0.055)], scale: [0.72, 0.52, 1.05] }, "MAT_Skin");
  add({ op: "mesh.create_primitive", name: "Mesh_Hand_R", primitive: "uv_sphere", radius: 0.055 * lt, location: [wristR[0] - 0.012, wristR[1] + 0.025, wristR[2] - z(h, 0.055)], scale: [0.72, 0.52, 1.05] }, "MAT_Skin");

  // Legs taper naturally, eliminating knee-ball segmentation.
  add({ op: "mesh.create_tapered_segment", name: "Mesh_Thigh_L", start: hipL, end: kneeL, radiusStart: 0.082 * lt, radiusEnd: 0.064 * lt, sides: 10 }, "MAT_Shorts");
  add({ op: "mesh.create_tapered_segment", name: "Mesh_Thigh_R", start: hipR, end: kneeR, radiusStart: 0.082 * lt, radiusEnd: 0.064 * lt, sides: 10 }, "MAT_Shorts");
  add({ op: "mesh.create_tapered_segment", name: "Mesh_Shin_L", start: kneeL, end: ankleL, radiusStart: 0.059 * lt, radiusEnd: 0.042 * lt, sides: 10 }, "MAT_Skin");
  add({ op: "mesh.create_tapered_segment", name: "Mesh_Shin_R", start: kneeR, end: ankleR, radiusStart: 0.059 * lt, radiusEnd: 0.042 * lt, sides: 10 }, "MAT_Skin");

  add({
    op: "mesh.create_tapered_box",
    name: "Mesh_Foot_L",
    location: [legX, 0.145, z(h, 0.055)],
    height: z(h, 0.09),
    topSize: [0.135 * lt, 0.245],
    bottomSize: [0.145 * lt, 0.29],
  }, "MAT_Shoes");
  add({
    op: "mesh.create_tapered_box",
    name: "Mesh_Foot_R",
    location: [-legX, 0.145, z(h, 0.055)],
    height: z(h, 0.09),
    topSize: [0.135 * lt, 0.245],
    bottomSize: [0.145 * lt, 0.29],
  }, "MAT_Shoes");

  // Small face features: readable close-up, not oversized balls at gameplay distance.
  add({ op: "mesh.create_primitive", name: "Mesh_Eye_L", primitive: "uv_sphere", radius: 0.015 * hs, location: [0.048 * hs, 0.127, z(h, 1.605)], scale: [1.0, 0.42, 0.72] }, "MAT_Eyes");
  add({ op: "mesh.create_primitive", name: "Mesh_Eye_R", primitive: "uv_sphere", radius: 0.015 * hs, location: [-0.048 * hs, 0.127, z(h, 1.605)], scale: [1.0, 0.42, 0.72] }, "MAT_Eyes");
  add({ op: "mesh.create_tapered_box", name: "Mesh_Nose", location: [0, 0.137, z(h, 1.565)], height: 0.05 * h, topSize: [0.026, 0.024], bottomSize: [0.034, 0.03] }, "MAT_Skin");

  if (spec.browIndication) {
    add({ op: "mesh.create_tapered_box", name: "Mesh_Brow_L", location: [0.048 * hs, 0.135, z(h, 1.635)], height: 0.012, topSize: [0.055, 0.012], bottomSize: [0.055, 0.012], rotationEulerDeg: [0, 0, -6] }, "MAT_Hair");
    add({ op: "mesh.create_tapered_box", name: "Mesh_Brow_R", location: [-0.048 * hs, 0.135, z(h, 1.635)], height: 0.012, topSize: [0.055, 0.012], bottomSize: [0.055, 0.012], rotationEulerDeg: [0, 0, 6] }, "MAT_Hair");
  }

  addHair(ops, meshes, spec, h, hs);

  // Light bevel only on major clothing/foot volumes before joining.
  ops.push(
    { op: "mesh.bevel", target: "Mesh_Torso", width: 0.022, segments: 2 },
    { op: "mesh.bevel", target: "Mesh_Pelvis", width: 0.018, segments: 2 },
    { op: "mesh.bevel", target: "Mesh_Foot_L", width: 0.012, segments: 2 },
    { op: "mesh.bevel", target: "Mesh_Foot_R", width: 0.012, segments: 2 },
  );

  // One deformable mesh means one skinning pass instead of auto-weighting ~30 disconnected objects.
  ops.push(
    { op: "mesh.join", name: "Mesh_Character", sources: meshes },
    { op: "mesh.smooth", target: "Mesh_Character", enabled: true },
  );

  // Same production-compatible 18-bone contract.
  ops.push(
    { op: "rig.create_armature", name: "Armature", location: [0, 0, 0] },
    { op: "rig.create_bone", armature: "Armature", name: "Root", head: [0, 0, 0], tail: [0, 0, z(h, 0.12)] },
    { op: "rig.create_bone", armature: "Armature", name: "Hips", parent: "Root", head: [0, 0, z(h, 0.58)], tail: [0, 0, z(h, 0.78)] },
    { op: "rig.create_bone", armature: "Armature", name: "Spine", parent: "Hips", head: [0, 0, z(h, 0.78)], tail: [0, 0, z(h, 1.05)] },
    { op: "rig.create_bone", armature: "Armature", name: "Chest", parent: "Spine", head: [0, 0, z(h, 1.05)], tail: [0, 0, z(h, 1.32)] },
    { op: "rig.create_bone", armature: "Armature", name: "Neck", parent: "Chest", head: [0, 0, z(h, 1.32)], tail: [0, 0, z(h, 1.46)] },
    { op: "rig.create_bone", armature: "Armature", name: "Head", parent: "Neck", head: [0, 0, z(h, 1.46)], tail: [0, 0, z(h, 1.72)] },
    { op: "rig.create_bone", armature: "Armature", name: "UpperArm_L", parent: "Chest", head: shoulderL, tail: elbowL },
    { op: "rig.create_bone", armature: "Armature", name: "ForeArm_L", parent: "UpperArm_L", head: elbowL, tail: wristL },
    { op: "rig.create_bone", armature: "Armature", name: "Hand_L", parent: "ForeArm_L", head: wristL, tail: [wristL[0] + 0.018, wristL[1] + 0.03, wristL[2] - z(h, 0.08)] },
    { op: "rig.create_bone", armature: "Armature", name: "UpperArm_R", parent: "Chest", head: shoulderR, tail: elbowR },
    { op: "rig.create_bone", armature: "Armature", name: "ForeArm_R", parent: "UpperArm_R", head: elbowR, tail: wristR },
    { op: "rig.create_bone", armature: "Armature", name: "Hand_R", parent: "ForeArm_R", head: wristR, tail: [wristR[0] - 0.018, wristR[1] + 0.03, wristR[2] - z(h, 0.08)] },
    { op: "rig.create_bone", armature: "Armature", name: "Thigh_L", parent: "Hips", head: hipL, tail: kneeL },
    { op: "rig.create_bone", armature: "Armature", name: "Shin_L", parent: "Thigh_L", head: kneeL, tail: ankleL },
    { op: "rig.create_bone", armature: "Armature", name: "Foot_L", parent: "Shin_L", head: ankleL, tail: [legX, 0.20, z(h, 0.045)] },
    { op: "rig.create_bone", armature: "Armature", name: "Thigh_R", parent: "Hips", head: hipR, tail: kneeR },
    { op: "rig.create_bone", armature: "Armature", name: "Shin_R", parent: "Thigh_R", head: kneeR, tail: ankleR },
    { op: "rig.create_bone", armature: "Armature", name: "Foot_R", parent: "Shin_R", head: ankleR, tail: [-legX, 0.20, z(h, 0.045)] },
    { op: "rig.parent_mesh", mesh: "Mesh_Character", armature: "Armature" },
    { op: "rig.assign_weights", mesh: "Mesh_Character", armature: "Armature", mode: "automatic" },
  );

  appendV3Locomotion(ops);

  ops.push(
    { op: "light.create", name: "Light_Key", type: "SUN", location: [4, -4, 6], energy: 3.2, rotationEulerDeg: [45, 12, 40] },
    { op: "light.create", name: "Light_Fill", type: "AREA", location: [-2.4, 2.6, 2.2], energy: 35 },
    { op: "camera.create", name: "Camera_Main", location: [2.4, -3.2, 1.55 * h], rotationEulerDeg: [70, 0, 38], setActive: true },
    { op: "file.save_blend", outputName: `${prefix}.blend` },
    { op: "render.preview", outputName: `${prefix}-preview.png`, width: 800, height: 800 },
    { op: "render.multi_view", outputPrefix: prefix, views: ["front", "side", "back", "three_quarter"], width: 720, height: 720 },
    { op: "export.character_glb", outputName: `${prefix}.glb` },
    { op: "animation.inspect" },
    { op: "character.inspect" },
  );

  return ops;
}

export function yunCharacterArtV3AcceptanceCriteria(spec: YunCharacterVariantSpec): readonly string[] {
  const prefix = `${spec.assetId}_v3`;
  return [
    `${prefix}.blend created`,
    "One joined deformable character mesh is skinned to the 18-bone armature",
    `${YUN_ROSTER_TEAM_COLOR_MATERIAL} present`,
    "idle, walk, and run animations with keyframes",
    "No elbow or knee ball-joint filler meshes are used",
    "multi-view V3 renders produced",
    `animated ${prefix}.glb exported`,
  ];
}

export function buildYunCharacterArtV3TaskSpec(
  spec: YunCharacterVariantSpec,
  workingDirectory: string,
): BlenderTaskSpec {
  const prefix = `${spec.assetId}_v3`;
  return {
    schemaVersion: BLENDER_TASK_SCHEMA_VERSION,
    assetName: prefix,
    operations: buildYunCharacterArtV3Operations(spec),
    workingDirectory,
    expectedArtifacts: [
      { kind: "blend", name: `${prefix}.blend`, required: true, minBytes: 1 },
      { kind: "glb", name: `${prefix}.glb`, required: true, minBytes: 1 },
      { kind: "json", name: `${prefix}-report.json`, required: true, minBytes: 1 },
      { kind: "json", name: "blender-report.json", required: true, minBytes: 1 },
      { kind: "png", name: `${prefix}-front.png`, required: true, minBytes: 512 },
      { kind: "png", name: `${prefix}-side.png`, required: true, minBytes: 512 },
      { kind: "png", name: `${prefix}-back.png`, required: true, minBytes: 512 },
      { kind: "png", name: `${prefix}-three-quarter.png`, required: true, minBytes: 512 },
      { kind: "png", name: `${prefix}-preview.png`, required: true, minBytes: 512 },
    ],
    acceptanceCriteria: yunCharacterArtV3AcceptanceCriteria(spec),
    renderSettings: { width: 720, height: 720 },
    exportSettings: { format: "GLB", exportSkins: true, exportAnimations: true },
    timeoutMs: 420_000,
  };
}

export function resolveYunCharacterArtV3FromGoal(goal: string): YunCharacterVariantSpec | undefined {
  const hay = goal.toLowerCase();
  const ids = [
    ["yun_player_base_v3", "yun_player_base"],
    ["yun_player_02_v3", "yun_player_02"],
    ["yun_player_03_v3", "yun_player_03"],
    ["yun_player_04_v3", "yun_player_04"],
  ] as const;
  for (const [candidate, source] of ids) {
    if (hay.includes(candidate)) return getYunRosterVariant(source);
  }
  if (hay.includes("yun character art v3") || hay.includes("yun v3 character")) {
    return getYunRosterVariant("yun_player_base");
  }
  return undefined;
}
