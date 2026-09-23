/**
 * First Yun production-candidate character: yun_player_base.
 *
 * Built entirely from bounded BlenderOperation primitives (not arbitrary Python).
 * Visual language: stylized street-sports athlete readable from Yun's court camera.
 * Team-color surface: MAT_TeamShirt (configurable without remodeling).
 *
 * Scale: ~1.7 Blender units tall so Godot wrapper scale 1.2 ≈ procedural stub height.
 * Animations: in-place idle/walk/run (YunMiniFigure drives locomotion via host velocity).
 */

import { BLENDER_TASK_SCHEMA_VERSION, type BlenderTaskSpec } from "./blenderTaskSpec.js";
import type { BlenderOperation } from "./blenderOperations.js";

export const YUN_PLAYER_BASE_ASSET_NAME = "yun_player_base" as const;

/** Material intended for per-team / per-player color replacement. */
export const YUN_PLAYER_BASE_TEAM_COLOR_MATERIAL = "MAT_TeamShirt" as const;

export const YUN_PLAYER_BASE_MATERIALS = [
  "MAT_Skin",
  "MAT_TeamShirt",
  "MAT_Shorts",
  "MAT_Shoes",
  "MAT_Accent",
] as const;

export const YUN_PLAYER_BASE_BONES = [
  "Root",
  "Hips",
  "Spine",
  "Chest",
  "Neck",
  "Head",
  "UpperArm_L",
  "ForeArm_L",
  "Hand_L",
  "UpperArm_R",
  "ForeArm_R",
  "Hand_R",
  "Thigh_L",
  "Shin_L",
  "Foot_L",
  "Thigh_R",
  "Shin_R",
  "Foot_R",
] as const;

export function buildYunPlayerBaseOperations(): BlenderOperation[] {
  const meshes = [
    "Mesh_Head",
    "Mesh_Torso",
    "Mesh_Pelvis",
    "Mesh_UpperArm_L",
    "Mesh_ForeArm_L",
    "Mesh_Hand_L",
    "Mesh_UpperArm_R",
    "Mesh_ForeArm_R",
    "Mesh_Hand_R",
    "Mesh_Thigh_L",
    "Mesh_Shin_L",
    "Mesh_Foot_L",
    "Mesh_Thigh_R",
    "Mesh_Shin_R",
    "Mesh_Foot_R",
  ] as const;

  const ops: BlenderOperation[] = [
    { op: "scene.new", sceneName: "YunPlayerBase" },

    // Street Yun palette: warm skin, mango team shirt, deep shorts, bright shoes, accent trim
    {
      op: "material.create",
      name: "MAT_Skin",
      baseColor: [0.78, 0.56, 0.4, 1],
      roughness: 0.55,
    },
    {
      op: "material.create",
      name: "MAT_TeamShirt",
      baseColor: [0.95, 0.72, 0.18, 1],
      roughness: 0.45,
    },
    {
      op: "material.create",
      name: "MAT_Shorts",
      baseColor: [0.12, 0.18, 0.32, 1],
      roughness: 0.6,
    },
    {
      op: "material.create",
      name: "MAT_Shoes",
      baseColor: [0.92, 0.92, 0.94, 1],
      roughness: 0.4,
    },
    {
      op: "material.create",
      name: "MAT_Accent",
      baseColor: [0.15, 0.85, 0.55, 1],
      roughness: 0.35,
    },

    // Body — stylized readable proportions (~1.72 units tall)
    { op: "mesh.create_primitive", name: "Mesh_Head", primitive: "uv_sphere", radius: 0.16, location: [0, 0, 1.58] },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Torso",
      primitive: "cube",
      size: 0.5,
      location: [0, 0, 1.12],
      scale: [0.72, 0.38, 0.85],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Pelvis",
      primitive: "cube",
      size: 0.42,
      location: [0, 0, 0.72],
      scale: [0.78, 0.4, 0.42],
    },

    // Arms
    {
      op: "mesh.create_primitive",
      name: "Mesh_UpperArm_L",
      primitive: "cylinder",
      radius: 0.055,
      depth: 0.32,
      location: [0.34, 0, 1.22],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_ForeArm_L",
      primitive: "cylinder",
      radius: 0.045,
      depth: 0.3,
      location: [0.5, 0, 0.98],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Hand_L",
      primitive: "cube",
      size: 0.12,
      location: [0.58, 0, 0.8],
      scale: [0.7, 0.45, 1.1],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_UpperArm_R",
      primitive: "cylinder",
      radius: 0.055,
      depth: 0.32,
      location: [-0.34, 0, 1.22],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_ForeArm_R",
      primitive: "cylinder",
      radius: 0.045,
      depth: 0.3,
      location: [-0.5, 0, 0.98],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Hand_R",
      primitive: "cube",
      size: 0.12,
      location: [-0.58, 0, 0.8],
      scale: [0.7, 0.45, 1.1],
    },

    // Legs + shoes
    {
      op: "mesh.create_primitive",
      name: "Mesh_Thigh_L",
      primitive: "cylinder",
      radius: 0.07,
      depth: 0.38,
      location: [0.12, 0, 0.5],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shin_L",
      primitive: "cylinder",
      radius: 0.055,
      depth: 0.36,
      location: [0.12, 0, 0.2],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Foot_L",
      primitive: "cube",
      size: 0.18,
      location: [0.12, 0.06, 0.04],
      scale: [0.7, 1.35, 0.4],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Thigh_R",
      primitive: "cylinder",
      radius: 0.07,
      depth: 0.38,
      location: [-0.12, 0, 0.5],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Shin_R",
      primitive: "cylinder",
      radius: 0.055,
      depth: 0.36,
      location: [-0.12, 0, 0.2],
    },
    {
      op: "mesh.create_primitive",
      name: "Mesh_Foot_R",
      primitive: "cube",
      size: 0.18,
      location: [-0.12, 0.06, 0.04],
      scale: [0.7, 1.35, 0.4],
    },

    // Light bevel on torso/shirt silhouette
    { op: "mesh.bevel", target: "Mesh_Torso", width: 0.02, segments: 2 },
    { op: "mesh.bevel", target: "Mesh_Pelvis", width: 0.015, segments: 2 },

    // Materials
    { op: "material.assign", target: "Mesh_Head", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Torso", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Mesh_Pelvis", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_UpperArm_L", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Mesh_ForeArm_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Hand_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_UpperArm_R", material: "MAT_TeamShirt" },
    { op: "material.assign", target: "Mesh_ForeArm_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Hand_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Thigh_L", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_Shin_L", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Foot_L", material: "MAT_Shoes" },
    { op: "material.assign", target: "Mesh_Thigh_R", material: "MAT_Shorts" },
    { op: "material.assign", target: "Mesh_Shin_R", material: "MAT_Skin" },
    { op: "material.assign", target: "Mesh_Foot_R", material: "MAT_Shoes" },

    // Armature
    { op: "rig.create_armature", name: "Armature", location: [0, 0, 0] },
    { op: "rig.create_bone", armature: "Armature", name: "Root", head: [0, 0, 0], tail: [0, 0, 0.12] },
    { op: "rig.create_bone", armature: "Armature", name: "Hips", parent: "Root", head: [0, 0, 0.58], tail: [0, 0, 0.78] },
    { op: "rig.create_bone", armature: "Armature", name: "Spine", parent: "Hips", head: [0, 0, 0.78], tail: [0, 0, 1.05] },
    { op: "rig.create_bone", armature: "Armature", name: "Chest", parent: "Spine", head: [0, 0, 1.05], tail: [0, 0, 1.32] },
    { op: "rig.create_bone", armature: "Armature", name: "Neck", parent: "Chest", head: [0, 0, 1.32], tail: [0, 0, 1.45] },
    { op: "rig.create_bone", armature: "Armature", name: "Head", parent: "Neck", head: [0, 0, 1.45], tail: [0, 0, 1.7] },

    { op: "rig.create_bone", armature: "Armature", name: "UpperArm_L", parent: "Chest", head: [0.2, 0, 1.28], tail: [0.38, 0, 1.12] },
    { op: "rig.create_bone", armature: "Armature", name: "ForeArm_L", parent: "UpperArm_L", head: [0.38, 0, 1.12], tail: [0.52, 0, 0.92] },
    { op: "rig.create_bone", armature: "Armature", name: "Hand_L", parent: "ForeArm_L", head: [0.52, 0, 0.92], tail: [0.6, 0, 0.78] },

    { op: "rig.create_bone", armature: "Armature", name: "UpperArm_R", parent: "Chest", head: [-0.2, 0, 1.28], tail: [-0.38, 0, 1.12] },
    { op: "rig.create_bone", armature: "Armature", name: "ForeArm_R", parent: "UpperArm_R", head: [-0.38, 0, 1.12], tail: [-0.52, 0, 0.92] },
    { op: "rig.create_bone", armature: "Armature", name: "Hand_R", parent: "ForeArm_R", head: [-0.52, 0, 0.92], tail: [-0.6, 0, 0.78] },

    { op: "rig.create_bone", armature: "Armature", name: "Thigh_L", parent: "Hips", head: [0.12, 0, 0.7], tail: [0.12, 0, 0.38] },
    { op: "rig.create_bone", armature: "Armature", name: "Shin_L", parent: "Thigh_L", head: [0.12, 0, 0.38], tail: [0.12, 0, 0.08] },
    { op: "rig.create_bone", armature: "Armature", name: "Foot_L", parent: "Shin_L", head: [0.12, 0, 0.08], tail: [0.12, 0.14, 0.04] },

    { op: "rig.create_bone", armature: "Armature", name: "Thigh_R", parent: "Hips", head: [-0.12, 0, 0.7], tail: [-0.12, 0, 0.38] },
    { op: "rig.create_bone", armature: "Armature", name: "Shin_R", parent: "Thigh_R", head: [-0.12, 0, 0.38], tail: [-0.12, 0, 0.08] },
    { op: "rig.create_bone", armature: "Armature", name: "Foot_R", parent: "Shin_R", head: [-0.12, 0, 0.08], tail: [-0.12, 0.14, 0.04] },
  ];

  for (const mesh of meshes) {
    ops.push({ op: "rig.parent_mesh", mesh, armature: "Armature" });
    ops.push({ op: "rig.assign_weights", mesh, armature: "Armature" });
  }

  // Idle — subtle breathing / sway (in-place)
  ops.push({ op: "animation.create_action", name: "idle", armature: "Armature", frameStart: 1, frameEnd: 48 });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Spine", frame: 1, rotationEulerDeg: [0, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Spine", frame: 24, rotationEulerDeg: [3, 0, 1] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Spine", frame: 48, rotationEulerDeg: [0, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Chest", frame: 1, rotationEulerDeg: [0, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Chest", frame: 24, rotationEulerDeg: [2, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "Chest", frame: 48, rotationEulerDeg: [0, 0, 0] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "UpperArm_L", frame: 1, rotationEulerDeg: [5, 0, 8] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "UpperArm_R", frame: 1, rotationEulerDeg: [5, 0, -8] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "UpperArm_L", frame: 24, rotationEulerDeg: [8, 0, 10] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "UpperArm_R", frame: 24, rotationEulerDeg: [8, 0, -10] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "UpperArm_L", frame: 48, rotationEulerDeg: [5, 0, 8] });
  ops.push({ op: "animation.insert_keyframe", armature: "Armature", action: "idle", bone: "UpperArm_R", frame: 48, rotationEulerDeg: [5, 0, -8] });

  // Walk — clear opposing leg/arm cycle
  ops.push({ op: "animation.create_action", name: "walk", armature: "Armature", frameStart: 1, frameEnd: 32 });
  for (const [frame, thighL, thighR, armL, armR] of [
    [1, 28, -28, -20, 20],
    [16, -28, 28, 20, -20],
    [32, 28, -28, -20, 20],
  ] as const) {
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "Thigh_L",
      frame,
      rotationEulerDeg: [thighL, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "Thigh_R",
      frame,
      rotationEulerDeg: [thighR, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "UpperArm_L",
      frame,
      rotationEulerDeg: [armL, 0, 5],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "walk",
      bone: "UpperArm_R",
      frame,
      rotationEulerDeg: [armR, 0, -5],
    });
  }

  // Run — faster, larger amplitude (still in-place; Godot host owns locomotion)
  ops.push({ op: "animation.create_action", name: "run", armature: "Armature", frameStart: 1, frameEnd: 20 });
  for (const [frame, thighL, thighR, armL, armR, chest] of [
    [1, 48, -48, -35, 35, 8],
    [10, -48, 48, 35, -35, 12],
    [20, 48, -48, -35, 35, 8],
  ] as const) {
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "Thigh_L",
      frame,
      rotationEulerDeg: [thighL, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "Thigh_R",
      frame,
      rotationEulerDeg: [thighR, 0, 0],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "UpperArm_L",
      frame,
      rotationEulerDeg: [armL, 0, 8],
    });
    ops.push({
      op: "animation.insert_keyframe",
      armature: "Armature",
      action: "run",
      bone: "UpperArm_R",
      frame,
      rotationEulerDeg: [armR, 0, -8],
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

  ops.push(
    {
      op: "light.create",
      name: "Light_Key",
      type: "SUN",
      location: [4, -4, 6],
      energy: 3.8,
      rotationEulerDeg: [45, 15, 45],
    },
    {
      op: "light.create",
      name: "Light_Fill",
      type: "POINT",
      location: [-2.5, 2.5, 2.2],
      energy: 40,
    },
    {
      op: "camera.create",
      name: "Camera_Main",
      location: [2.6, -2.8, 1.5],
      rotationEulerDeg: [72, 0, 42],
      setActive: true,
    },
    { op: "file.save_blend", outputName: "yun_player_base.blend" },
    { op: "render.preview", outputName: "yun_player_base-preview.png", width: 720, height: 720 },
    {
      op: "render.multi_view",
      outputPrefix: "yun_player_base",
      views: ["front", "side", "back", "three_quarter"],
      width: 640,
      height: 640,
    },
    { op: "export.character_glb", outputName: "yun_player_base.glb" },
    { op: "animation.inspect" },
    { op: "character.inspect" },
  );

  return ops;
}

export function buildYunPlayerBaseTaskSpec(workingDirectory: string): BlenderTaskSpec {
  return {
    schemaVersion: BLENDER_TASK_SCHEMA_VERSION,
    assetName: YUN_PLAYER_BASE_ASSET_NAME,
    operations: buildYunPlayerBaseOperations(),
    workingDirectory,
    expectedArtifacts: [
      { kind: "blend", name: "yun_player_base.blend", required: true, minBytes: 1 },
      { kind: "glb", name: "yun_player_base.glb", required: true, minBytes: 1 },
      { kind: "json", name: "yun_player_base-report.json", required: true, minBytes: 1 },
      { kind: "json", name: "blender-report.json", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base-front.png", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base-side.png", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base-back.png", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base-three-quarter.png", required: true, minBytes: 1 },
      { kind: "png", name: "yun_player_base-preview.png", required: true, minBytes: 1 },
    ],
    acceptanceCriteria: [
      "yun_player_base.blend created",
      "armature with named bones present",
      "mesh skinned to armature",
      "MAT_TeamShirt team-color material present",
      "idle, walk, and run animations present with keyframes",
      "multi-view renders produced",
      "animated yun_player_base.glb exported",
    ],
    renderSettings: { width: 640, height: 640 },
    exportSettings: { format: "GLB", exportSkins: true, exportAnimations: true },
    timeoutMs: 360_000,
  };
}
